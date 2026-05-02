import { Construction } from 'lucide-react';

export function PlaceholderPage({ titulo, descricao, etapa }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-navy-100 rounded-2xl flex items-center
                        justify-center mx-auto mb-4">
          <Construction size={28} className="text-navy-600" />
        </div>
        <h2 className="font-display font-semibold text-navy-800 text-xl mb-2">
          {titulo}
        </h2>
        <p className="text-slate-500 text-sm">{descricao}</p>
        {etapa && (
          <span className="mt-4 inline-block px-3 py-1 bg-gold-100 text-gold-700
                           rounded-full text-xs font-medium">
            Em desenvolvimento — {etapa}
          </span>
        )}
      </div>
    </div>
  );
}

export function LancamentosPage() {
  return <PlaceholderPage titulo="Lançamentos" descricao="Lançamentos de receitas e despesas." etapa="Etapa 3" />;
}
export function ContasPagarPage() {
  return <PlaceholderPage titulo="Contas a Pagar" descricao="Gestão de contas a pagar." etapa="Etapa 4" />;
}
export function ContasReceberPage() {
  return <PlaceholderPage titulo="Contas a Receber" descricao="Gestão de contas a receber." etapa="Etapa 4" />;
}
export function ExtratoPage() {
  return <PlaceholderPage titulo="Extrato Bancário" descricao="Extrato das contas bancárias." etapa="Etapa 3" />;
}
export function ImportacaoOFXPage() {
  return <PlaceholderPage titulo="Importação OFX" descricao="Importe extratos bancários." etapa="Etapa 5" />;
}
export function CategoriasPage() {
  return <PlaceholderPage titulo="Categorias" descricao="Plano de contas com códigos Domínio." etapa="Etapa 2" />;
}
export function PadroesOFXPage() {
  return <PlaceholderPage titulo="Padrões OFX" descricao="De-Para automático de históricos bancários." etapa="Etapa 2" />;
}
export function EstoquePage() {
  return <PlaceholderPage titulo="Controle de Estoque" descricao="Ajustes manuais de estoque e CMV." etapa="Etapa 6" />;
}
export function DREPage() {
  return <PlaceholderPage titulo="DRE" descricao="Demonstração do Resultado do Exercício." etapa="Etapa 7" />;
}
export function DFCPage() {
  return <PlaceholderPage titulo="DFC" descricao="Demonstração do Fluxo de Caixa." etapa="Etapa 7" />;
}
export function ExportacaoDominioPage() {
  return <PlaceholderPage titulo="Exportação Domínio" descricao="Gere o TXT para importar no Domínio Contábil." etapa="Etapa 8" />;
}
export function FechamentoPage() {
  return <PlaceholderPage titulo="Fechamento de Competência" descricao="Feche competências e bloqueie lançamentos." etapa="Etapa 9" />;
}
export function UsuariosEmpresaPage() {
  return <PlaceholderPage titulo="Usuários" descricao="Gerencie os usuários desta empresa." etapa="Etapa 1 — em breve" />;
}
export function AdminFechamentosPage() {
  return <PlaceholderPage titulo="Fechamentos" descricao="Status de fechamento de todos os clientes." etapa="Etapa 9" />;
}
