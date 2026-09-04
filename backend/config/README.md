# Chave do Google Drive

A importação automática de OFX depende de uma **conta de serviço** do Google
Cloud. O arquivo JSON dessa conta precisa ficar aqui, com este nome exato:

```
backend/config/google-drive-key.json
```

Ele **não vai para o git** (está no `.gitignore`) — é uma credencial. E também
não é assado na imagem Docker: o `docker-compose.yml` monta esta pasta como
volume somente-leitura em `/app/config`, para a chave sobreviver aos rebuilds.

## Para ativar

1. No Google Cloud, crie (ou reaproveite) uma conta de serviço com a **API do
   Google Drive** habilitada e gere uma chave JSON
2. Copie o arquivo para `backend/config/google-drive-key.json` **no servidor**
3. No Google Drive, compartilhe a pasta dos extratos com o e-mail da conta de
   serviço (algo como `nome@projeto.iam.gserviceaccount.com`), com permissão de
   edição — ela precisa mover os arquivos para "✅ Processados"
4. No `.env` do servidor, defina `GOOGLE_DRIVE_ENABLED=true`
5. Reinicie: `docker compose up -d backend`

O log do backend diz, na partida, se a importação automática subiu ou não e por
quê:

```
docker logs totali_backend | grep "Google Drive"
```
