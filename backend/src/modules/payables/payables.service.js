const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function list(tenantId, filters={}) {
  const {type,status,search,dateFrom,dateTo,page=1,limit=50}=filters;
  const skip=(page-1)*limit;
  const where={
    tenant_id:tenantId,
    ...(type&&{type}),
    ...(status&&status!=='ALL'?{status}:{}),
    ...(dateFrom||dateTo?{due_date:{...(dateFrom&&{gte:new Date(dateFrom)}), ...(dateTo&&{lte:new Date(dateTo)})}}:{}),
    ...(search&&{OR:[{description:{contains:search,mode:'insensitive'}},{contact_name:{contains:search,mode:'insensitive'}}]}),
  };
  const [data,total]=await Promise.all([
    prisma.payable_receivable.findMany({where,include:{category:{select:{id:true,name:true}},bank_account:{select:{id:true,name:true}}},orderBy:{due_date:'asc'},skip,take:limit}),
    prisma.payable_receivable.count({where})
  ]);
  return {data,total,page,totalPages:Math.ceil(total/limit)};
}

async function summary(tenantId){
  const today=new Date();today.setHours(0,0,0,0);
  const[po,ro,pod,rod]=await Promise.all([
    prisma.payable_receivable.aggregate({where:{tenant_id:tenantId,type:'PAYABLE',status:{in:['OPEN','PARTIAL']}},_sum:{amount:true},_count:true}),
    prisma.payable_receivable.aggregate({where:{tenant_id:tenantId,type:'RECEIVABLE',status:{in:['OPEN','PARTIAL']}},_sum:{amount:true},_count:true}),
    prisma.payable_receivable.aggregate({where:{tenant_id:tenantId,type:'PAYABLE',status:{in:['OPEN','PARTIAL']},due_date:{lt:today}},_sum:{amount:true},_count:true}),
    prisma.payable_receivable.aggregate({where:{tenant_id:tenantId,type:'RECEIVABLE',status:{in:['OPEN','PARTIAL']},due_date:{lt:today}},_sum:{amount:true},_count:true}),
  ]);
  return{payables:{total:Number(po._sum.amount||0),count:po._count,overdue:Number(pod._sum.amount||0),overdueCount:pod._count},receivables:{total:Number(ro._sum.amount||0),count:ro._count,overdue:Number(rod._sum.amount||0),overdueCount:rod._count}};
}

async function findOne(id,tenantId){
  const r=await prisma.payable_receivable.findFirst({where:{id,tenant_id:tenantId},include:{category:true,bank_account:true,transaction:true}});
  if(!r)throw new Error('Título não encontrado');
  return r;
}

async function create(tenantId,userId,data){
  const{type,description,amount,due_date,category_id,document_number,contact_name,notes}=data;
  if(!type||!['PAYABLE','RECEIVABLE'].includes(type))throw new Error('Tipo inválido');
  if(!description)throw new Error('Descrição obrigatória');
  if(!amount||amount<=0)throw new Error('Valor inválido');
  if(!due_date)throw new Error('Vencimento obrigatório');
  const d=new Date(due_date);
  return prisma.payable_receivable.create({data:{tenant_id:tenantId,type,description,amount,due_date:d,status:'OPEN',category_id:category_id||null,document_number:document_number||null,contact_name:contact_name||null,notes:notes||null,competence_month:d.getMonth()+1,competence_year:d.getFullYear(),created_by:userId},include:{category:true,bank_account:true}});
}

async function update(id,tenantId,data){
  const r=await findOne(id,tenantId);
  if(r.status==='PAID')throw new Error('Título pago não pode ser editado');
  if(r.status==='CANCELLED')throw new Error('Título cancelado não pode ser editado');
  const{description,amount,due_date,category_id,document_number,contact_name,notes}=data;
  return prisma.payable_receivable.update({where:{id},data:{...(description&&{description}),..( amount&&{amount}),...(due_date&&{due_date:new Date(due_date)}),...(category_id!==undefined&&{category_id}),...(document_number!==undefined&&{document_number}),...(contact_name!==undefined&&{contact_name}),...(notes!==undefined&&{notes})},include:{category:true,bank_account:true}});
}

async function remove(id,tenantId){
  const r=await findOne(id,tenantId);
  if(r.status==='PAID')throw new Error('Título pago não pode ser excluído');
  await prisma.payable_receivable.delete({where:{id}});
  return{ok:true};
}

async function baixar(id,tenantId,userId,data){
  const{paid_date,paid_amount,bank_account_id,notes}=data;
  if(!paid_date)throw new Error('Data de pagamento obrigatória');
  if(!paid_amount||paid_amount<=0)throw new Error('Valor pago inválido');
  if(!bank_account_id)throw new Error('Conta bancária obrigatória');
  const r=await findOne(id,tenantId);
  if(r.status==='PAID')throw new Error('Título já baixado');
  if(r.status==='CANCELLED')throw new Error('Título cancelado');
  const ba=await prisma.bank_account.findFirst({where:{id:bank_account_id,tenant_id:tenantId}});
  if(!ba)throw new Error('Conta não encontrada');
  const pd=new Date(paid_date);
  let domFields={};
  if(r.category_id){const c=await prisma.category.findUnique({where:{id:r.category_id}});if(c){domFields={dominio_conta_debito:c.dominio_conta_debito,dominio_conta_credito:c.dominio_conta_credito,dominio_historico:c.dominio_historico,dominio_centro_custo_d:c.dominio_centro_custo_d,dominio_centro_custo_c:c.dominio_centro_custo_c};}}
  const txn=await prisma.transaction.create({data:{tenant_id:tenantId,type:r.type==='PAYABLE'?'EXPENSE':'INCOME',description:r.description,amount:paid_amount,date:pd,bank_account_id,category_id:r.category_id,status:'PAID',document_number:r.document_number,contact_name:r.contact_name,notes:notes||null,competence_month:pd.getMonth()+1,competence_year:pd.getFullYear(),...domFields,created_by:userId}});
  const isFullyPaid=paid_amount>=r.amount;
  return prisma.payable_receivable.update({where:{id},data:{status:isFullyPaid?'PAID':'PARTIAL',paid_date:pd,paid_amount,bank_account_id,transaction_id:txn.id},include:{category:true,bank_account:true,transaction:true}});
}

async function cancelar(id,tenantId){
  const r=await findOne(id,tenantId);
  if(r.status==='PAID')throw new Error('Título pago não pode ser cancelado');
  return prisma.payable_receivable.update({where:{id},data:{status:'CANCELLED'}});
}

module.exports={list,summary,findOne,create,update,remove,baixar,cancelar};
