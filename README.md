# Agenda PVH

Lista telefônica online de serviços para Porto Velho–RO. Busca por serviço (incluindo “construção” para pedreiros), nome, descrição e bairro. Interface responsiva em português, telefone e WhatsApp, cadastro com consentimento e revisão antes da publicação.

## Executar

Requer Node.js 24 ou superior. Não há dependências npm externas. O banco é exclusivamente Supabase, tanto localmente quanto na Vercel.

```sh
npm ci
npm test
npm run check
cp .env.example .env
# Preencha SUPABASE_URL, SUPABASE_SECRET_KEY e ADMIN_PASSWORD no .env
npm start
```

A porta padrão é 3000. `PORT` e `HOST` são opcionais. `npm run dev` reinicia o servidor após alterações. Os comandos carregam automaticamente o arquivo `.env`, quando existir. Configure o Supabase antes de iniciar.

## Cadastros e moderação

A base começa vazia: não são exibidos profissionais ou telefones fictícios. Um cadastro enviado pelo site fica pendente e não aparece na API pública até aprovação. A administração pelo navegador fica em `/admin`. Configure uma senha forte ao iniciar o servidor:

```sh
ADMIN_PASSWORD='sua-senha-forte' npm start
```

Abra `http://localhost:3000/admin` (ou `/admin` no seu domínio), informe a senha e use os filtros **Pendentes**, **Publicados** e **Todos**. Cada cadastro mostra seus dados e permite aprovar ou remover, com confirmação. A aprovação publica imediatamente na busca; a remoção exclui do banco.

A senha é configurada em `ADMIN_PASSWORD` no ambiente da hospedagem. Sem essa variável, a API administrativa fica desativada. Não há senha padrão. A senha digitada fica somente na memória da página; sair ou recarregar exige novo acesso. Use HTTPS em produção. Após dez falhas de autenticação por IP, o acesso fica bloqueado até completar 15 minutos da primeira falha; atrás de proxy esse limite pode ser compartilhado.

Também é possível administrar pelo terminal:

```sh
npm run cadastros
npm run aprovar -- ID_DO_CADASTRO
npm run remover -- ID_DO_CADASTRO
```

Antes de aprovar, confirme com o titular a autorização, o telefone, o serviço e a região atendida. A listagem administrativa inclui telefones: trate a saída como dados pessoais. O comando de remoção também atende solicitações de exclusão. A aprovação é uma revisão do cadastro, não uma certificação da qualidade do serviço.

## Validação

`npm test` cobre cadastro, privacidade de pendentes, aprovação, filtros, acentos, telefone, duplicidade, validação, origem, tamanho e limite de requisições. Os testes usam dados simulados em memória e respostas HTTP simuladas do Supabase, sem alterar os cadastros reais. `npm run check` verifica a sintaxe do servidor e do JavaScript do navegador.

## Publicação na Vercel com Supabase

1. Crie um projeto no Supabase e execute o conteúdo de `supabase/schema.sql` no **SQL Editor** do próprio painel Supabase. Essa ferramenta cria a tabela uma única vez; não é um banco separado nem precisa ficar aberta para o site funcionar.
2. Copie a URL do projeto e uma chave **secret** (`sb_secret_...`) em **Settings → API Keys**. Uma chave legada `service_role` também é aceita. Não use a chave `anon` ou `publishable`.
3. No projeto da Vercel, em **Settings → Environment Variables**, configure:
   - `SUPABASE_URL`: URL do projeto, como `https://seu-projeto.supabase.co`.
   - `SUPABASE_SECRET_KEY`: chave secreta do Supabase. Para chave legada, use `SUPABASE_SERVICE_ROLE_KEY`.
   - `ADMIN_PASSWORD`: sua senha forte de administração.
4. Aplique as variáveis ao ambiente **Production** e, se for usar, **Preview**. Publique este código no Git e faça um novo deploy. O `vercel.json` configura a função Node e as rotas; use Node.js 24.x, sem sobrescrever o diretório de saída e o comando de build no painel.
5. Confira `/api/health` (deve responder `{"ok":true}`), envie um cadastro e aprove em `/admin`. Confira se ele aparece na busca após aprovação.

As chaves ficam apenas no servidor. O SQL ativa RLS e retira o acesso direto dos papéis públicos: consulta, cadastro e moderação passam pela API do projeto. Não coloque a chave em arquivos de `public/`, no Git ou em variáveis com prefixo público.

Criar a tabela não transfere cadastros do SQLite automaticamente. Se já houver dados em `data/agenda.sqlite`, preserve uma cópia antes da troca; eles precisam ser importados separadamente. Sem as variáveis, o servidor não inicia localmente e responde com erro de configuração na Vercel.

Para executar localmente, copie `.env.example` para `.env` e preencha os valores. Use `npm start`, `npm run cadastros`, `npm run aprovar -- ID` ou `npm run remover -- ID`. Todos usam o mesmo projeto Supabase configurado no ambiente.

Os limites de tentativas ficam em memória por instância, e não são globais na Vercel. Configure regras de limitação no proxy para uma implantação com maior tráfego.

Referências: [chaves de API Supabase](https://supabase.com/docs/guides/getting-started/api-keys) e [funções Node na Vercel](https://vercel.com/docs/functions/runtimes/node-js).

Antes de divulgar o site, configure seu domínio, o responsável pelo tratamento dos dados, um canal real para pedidos de exclusão e uma política de privacidade adequada à operação. Não há pagamentos, contas de usuários, cálculo de distância por GPS ou verificação automática de profissionais nesta versão. A proximidade é por bairro informado, sem promessa de distância exata.

## Bairros

As sugestões de bairro na busca e no cadastro incluem os 71 nomes do [Compêndio dos Bairros do Distrito Sede, do Geoportal da Prefeitura](https://geoportal.portovelho.ro.gov.br/compendios_bairros.html), consultado em 29/10/2026. Foi corrigida a grafia de Tancredo Neves na lista. Os campos continuam permitindo digitação livre para localidades não listadas.

## Edição pelo administrador

Em `/admin`, escolha **Visualização → Tabela do banco** para consultar os cadastros em linhas. Use a busca e o filtro de status para localizar registros. **Editar** permite alterar nome, profissão, bairro, telefone, descrição, WhatsApp e status; **Salvar alterações** grava no Supabase. Alterações em cadastros publicados aparecem imediatamente no site. **Remover** exclui o registro após confirmação. O ID e a data original do cadastro são preservados na edição.
