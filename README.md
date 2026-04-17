# Sistema de Gestão de Frota

Um sistema completo e moderno para controle de frotas de veículos, motoristas, abastecimentos e manutenções preventivas.

## 🚀 Funcionalidades

- **Dashboard Inteligente:** Indicadores de consumo (KM/L), custos totais, tendências e alertas automáticos.
- **Gestão de Veículos:** Cadastro completo com placa, modelo, marca, ano, RENAVAM, chassis e status.
- **Controle de Abastecimento:** Registro de transações, integração com postos, cálculo automático de consumo médio e detecção de inconsistências de odômetro.
- **Manutenção Preventiva:** Alertas inteligentes baseados em quilometragem e tempo (data de vencimento).
- **Gestão de Motoristas e Ajudantes:** Cadastro de condutores com controle de validade de CNH.
- **Relatórios de Custos:** Visão detalhada de gastos por veículo, modelo e categoria.
- **Segurança:** Autenticação via JWT, controle de permissões por perfil e proteção contra ataques comuns (Helmet, Rate Limit).

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React 19, Tailwind CSS 4, Lucide React, Recharts, Motion.
- **Backend:** Node.js, Express.
- **Banco de Dados:** Supabase (PostgreSQL).
- **Build Tool:** Vite.

## 📦 Instalação e Configuração

### Pré-requisitos

- Node.js (v18 ou superior)
- npm ou yarn
- Conta no Supabase (https://supabase.com)

### Passos para Instalação

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/seu-usuario/sistema-gestao-frota.git
   cd sistema-gestao-frota
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure o Supabase:**
   - Crie um novo projeto no Supabase.
   - No painel do Supabase, vá em **SQL Editor** e crie uma nova query.
   - Copie o conteúdo do arquivo `supabase_schema.sql` e execute-o. Isso criará todas as tabelas e concederá as permissões necessárias.
   - Vá em **Project Settings > API** e obtenha a `Project URL`, a `anon key` e a `service_role key`.

4. **Configure as variáveis de ambiente:**
   Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Preencha as seguintes variáveis:
   - `URL_SUPABASE`: Sua Project URL.
   - `SUPABASE_ANON_KEY`: Sua anon key.
   - `SUPABASE_SERVICE_ROLE_KEY`: Sua service_role key (necessária para o backend).
   - `JWT_SECRET`: Uma chave secreta para os tokens JWT.
   - `VITE_SUPABASE_URL`: Mesma que URL_SUPABASE.
   - `VITE_SUPABASE_ANON_KEY`: Mesma que SUPABASE_ANON_KEY.

5. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
   O sistema estará disponível em `http://localhost:3000`.

## 🔒 Segurança e Acesso Inicial

O sistema tentará criar automaticamente um administrador padrão no primeiro acesso se as tabelas estiverem vazias:
- **Email:** `admin@fleetsmart.com`
- **Senha:** `admin123`

**IMPORTANTE:** Se você receber o erro "permission denied for schema public", certifique-se de que executou a parte final do script `supabase_schema.sql` que concede permissões ao `service_role`.

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
