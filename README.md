# Agenda PVH

Lista telefônica online de serviços para Porto Velho–RO. Busca por serviço (incluindo “construção” para pedreiros), nome, descrição e bairro. Interface responsiva em português, telefone e WhatsApp, cadastro com consentimento e revisão antes da publicação.

## Executar

Requer Node.js 24 ou superior. Não há dependências externas, chaves de API ou serviços pagos.

```sh
cd /workspace/agenda
npm ci
npm test
npm run check
npm start
```

A porta padrão é 3000. `PORT` e `HOST` são opcionais. `npm run dev` reinicia o servidor após alterações. O banco SQLite é criado automaticamente em `data/agenda.sqlite`; use `DB_PATH` para outro caminho. O Node pode emitir um aviso sobre a API SQLite experimental.

## Cadastros e moderação

A base começa vazia: não são exibidos profissionais ou telefones fictícios. Um cadastro enviado pelo site fica pendente e não aparece na API pública até aprovação. A administração é feita somente no terminal do servidor:

```sh
npm run cadastros
npm run aprovar -- ID_DO_CADASTRO
npm run remover -- ID_DO_CADASTRO
```

Antes de aprovar, confirme com o titular a autorização, o telefone, o serviço e a região atendida. A listagem administrativa inclui telefones: trate a saída como dados pessoais. O comando de remoção também atende solicitações de exclusão. A aprovação é uma revisão do cadastro, não uma certificação da qualidade do serviço.

## Validação

`npm test` cobre cadastro, privacidade de pendentes, aprovação, filtros, acentos, telefone, duplicidade, validação, origem, tamanho e limite de requisições. Os testes usam bancos em memória, sem alterar os cadastros reais. `npm run check` verifica a sintaxe do servidor e do JavaScript do navegador.

## Publicação

Execute como processo Node persistente, com armazenamento durável para `data/`. Faça backups consistentes do SQLite (incluindo o estado WAL, ou usando a API de backup SQLite). Use HTTPS no proxy de produção. O limitador usa o endereço direto da conexão; atrás de um proxy ele pode agrupar visitantes no mesmo limite. Uma implantação pública com maior tráfego precisa de limite no proxy e processo de moderação operacional.

Antes de divulgar o site, configure seu domínio, o responsável pelo tratamento dos dados, um canal real para pedidos de exclusão e uma política de privacidade adequada à operação. Não há pagamentos, contas de usuários, cálculo de distância por GPS ou verificação automática de profissionais nesta versão. A proximidade é por bairro informado, sem promessa de distância exata.

O banco deve ficar em volume persistente: a publicação do ambiente de desenvolvimento não substitui hospedagem pública nem garante preservação dos futuros cadastros.
