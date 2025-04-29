require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');

const app = express();

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public')); // Servir arquivos da pasta "public"

// Rotas de páginas estáticas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
});

app.get('/sucesso', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sucesso.html'));
});

app.get('/cancelado', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cancelado.html'));
});

// 🔁 FLUXO 1: Redirecionamento com invoiceUrl (forma alternativa)
app.post('/assinar', async (req, res) => {
  const { nome, email, cpf, telefone } = req.body;

  try {
    // 1. Criar cliente no Asaas
    const cliente = await axios.post('https://sandbox.asaas.com/api/v3/customers', {
      name: nome,
      email: email,
      cpfCnpj: cpf,
      phone: telefone
    }, {
      headers: {
        'Content-Type': 'application/json',
        'access_token': process.env.ASAAS_API_KEY
      }
    });

    const clienteId = cliente.data.id;

    // 2. Criar cobrança única (fatura avulsa com redirecionamento)
    const cobranca = await axios.post('https://sandbox.asaas.com/api/v3/payments', {
      customer: clienteId,
      billingType: "CREDIT_CARD",
      value: 49.90,
      description: "Plano Fidelidade Villa Geyer",
      externalReference: "plano001",
      dueDate: new Date().toISOString().split('T')[0]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'access_token': process.env.ASAAS_API_KEY
      }
    });

    const invoiceUrl = cobranca.data.invoiceUrl;

    if (invoiceUrl) {
      console.log("🔗 Redirecionando para:", invoiceUrl);
      res.redirect(invoiceUrl);
    } else {
      console.error("❌ invoiceUrl não encontrado.");
      res.redirect('/cancelado');
    }

  } catch (erro) {
    console.error("❌ Erro no fluxo de redirecionamento:", erro.response?.data || erro.message);
    res.redirect('/cancelado');
  }
});

// 💳 FLUXO 2: Assinatura com cartão tokenizado (recomendado)
app.post('/finalizar-assinatura', async (req, res) => {
  const { name, email, cpf, phone, cardToken } = req.body;

  try {
    // 1. Criar cliente
    const cliente = await axios.post('https://sandbox.asaas.com/api/v3/customers', {
      name,
      email,
      cpfCnpj: cpf,
      phone
    }, {
      headers: {
        'Content-Type': 'application/json',
        'access_token': process.env.ASAAS_API_KEY
      }
    });

    // 2. Criar assinatura mensal (com cartão tokenizado)
    await axios.post('https://sandbox.asaas.com/api/v3/subscriptions', {
      customer: cliente.data.id,
      billingType: "CREDIT_CARD",
      creditCardToken: cardToken,
      value: 49.90,
      cycle: "MONTHLY",
      description: "Plano Fidelidade Villa Geyer",
      externalReference: "plano001"
    }, {
      headers: {
        'Content-Type': 'application/json',
        'access_token': process.env.ASAAS_API_KEY
      }
    });

    // ✅ Redireciona para a página de sucesso
    res.json({ redirectUrl: "/sucesso" });

  } catch (erro) {
    console.error("❌ Erro ao criar assinatura com cartão:", erro.response?.data || erro.message);
    res.json({ redirectUrl: "/cancelado" });

  }
});

// 🚀 Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});

