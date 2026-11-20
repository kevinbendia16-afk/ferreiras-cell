require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0');

function daysAgo(n) {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d;
}
function dateStr(d) { return d.toISOString().slice(0, 10); }
function tsStr(d) { return d.toISOString().slice(0, 19).replace('T', ' '); }

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Extra Users ──
    console.log('Criando usuários extras...');
    const h1 = await bcrypt.hash('123456', 10);
    const h2 = await bcrypt.hash('123456', 10);
    await client.query(
      `INSERT INTO usuarios (nome,email,senha,papel) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING`,
      ['Lucas Ferreira', 'lucas@ferreirascell.com', h1, 'tecnico']
    );
    await client.query(
      `INSERT INTO usuarios (nome,email,senha,papel) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING`,
      ['Camila Santos', 'camila@ferreirascell.com', h2, 'atendente']
    );
    const { rows: users } = await client.query('SELECT id, nome FROM usuarios ORDER BY id');
    const adminId = users[0].id;
    const tecnicoIds = users.filter(u => u.nome !== 'Camila Santos').map(u => u.id);

    // ── Clientes ──
    console.log('Inserindo clientes...');
    const clientes = [
      ['Maria Santos', '(19) 99812-3456', 'maria.santos@email.com', '123.456.789-01', 'Rua XV de Novembro, 230 - Centro, Piracicaba/SP'],
      ['João Silva', '(19) 99734-5678', 'joao.silva@email.com', '234.567.890-12', 'Av. Independência, 1500 - Alto, Piracicaba/SP'],
      ['Ana Oliveira', '(19) 99645-6789', 'ana.oliveira@email.com', '345.678.901-23', 'Rua do Porto, 85 - Centro, Piracicaba/SP'],
      ['Carlos Pereira', '(19) 99556-7890', null, '456.789.012-34', 'Rua Prudente de Moraes, 420 - Centro, Piracicaba/SP'],
      ['Fernanda Lima', '(19) 99467-8901', 'fernanda@email.com', '567.890.123-45', 'Av. Rui Barbosa, 710 - São Dimas, Piracicaba/SP'],
      ['Ricardo Souza', '(19) 99378-9012', null, '678.901.234-56', 'Rua Alferes José Caetano, 150 - Centro, Piracicaba/SP'],
      ['Juliana Costa', '(19) 99289-0123', 'juliana.costa@email.com', '789.012.345-67', 'Rua Moraes Barros, 900 - Centro, Piracicaba/SP'],
      ['Pedro Almeida', '(19) 99190-1234', null, '890.123.456-78', 'Av. Limeira, 2200 - Areião, Piracicaba/SP'],
      ['Luciana Ferreira', '(19) 99101-2345', 'luciana.f@email.com', '901.234.567-89', 'Rua São José, 340 - Vila Rezende, Piracicaba/SP'],
      ['Marcos Rocha', '(19) 99012-3456', null, '012.345.678-90', 'Rua Benjamin Constant, 55 - Centro, Piracicaba/SP'],
      ['Patricia Mendes', '(19) 98923-4567', 'patricia.m@email.com', '111.222.333-44', 'Av. Carlos Botelho, 800 - Alto, Piracicaba/SP'],
      ['Bruno Araújo', '(19) 98834-5678', null, '222.333.444-55', 'Rua Ipiranga, 160 - Centro, Piracicaba/SP'],
      ['Camila Ribeiro', '(19) 98745-6789', 'camila.r@email.com', '333.444.555-66', 'Rua Regente Feijó, 490 - Centro, Piracicaba/SP'],
      ['Diego Martins', '(19) 98656-7890', null, '444.555.666-77', 'Av. Beira Rio, 1100 - Nova Piracicaba, Piracicaba/SP'],
      ['Renata Gomes', '(19) 98567-8901', 'renata.g@email.com', '555.666.777-88', 'Rua Tiradentes, 300 - Centro, Piracicaba/SP'],
    ];
    const clienteIds = [];
    for (const [nome, tel, email, cpf, end] of clientes) {
      const { rows } = await client.query(
        `INSERT INTO clientes (nome,telefone,email,cpf,endereco) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT DO NOTHING RETURNING id`,
        [nome, tel, email, cpf, end]
      );
      if (rows.length) clienteIds.push(rows[0].id);
    }
    if (!clienteIds.length) {
      const { rows } = await client.query('SELECT id FROM clientes ORDER BY id LIMIT 15');
      clienteIds.push(...rows.map(r => r.id));
    }

    // ── Get some product IDs ──
    const { rows: telas } = await client.query("SELECT id, preco_venda FROM produtos WHERE categoria_id=1 LIMIT 10");
    const { rows: baterias } = await client.query("SELECT id, preco_venda FROM produtos WHERE categoria_id=2 LIMIT 5");
    const { rows: acessorios } = await client.query("SELECT id, nome, preco_venda FROM produtos WHERE categoria_id IN (6,7,8,9) LIMIT 20");

    // ── Update some stock so products are available ──
    console.log('Atualizando estoque para demo...');
    for (const p of [...telas, ...baterias]) {
      await client.query('UPDATE produtos SET estoque_atual = estoque_atual + $1 WHERE id=$2', [Math.floor(Math.random() * 5) + 2, p.id]);
    }
    for (const p of acessorios) {
      await client.query('UPDATE produtos SET estoque_atual = estoque_atual + $1 WHERE id=$2', [Math.floor(Math.random() * 15) + 5, p.id]);
    }

    // ── Ordens de Serviço ──
    console.log('Criando ordens de serviço...');
    const osData = [
      { marca: 'Apple', modelo: 'iPhone 13', defeito: 'Tela trincada após queda', status: 'entregue', vServ: 250, dias: 15 },
      { marca: 'Samsung', modelo: 'Galaxy S23', defeito: 'Não carrega / conector solto', status: 'entregue', vServ: 180, dias: 12 },
      { marca: 'Motorola', modelo: 'Moto G84', defeito: 'Bateria viciada - desliga sozinho', status: 'entregue', vServ: 150, dias: 10 },
      { marca: 'Xiaomi', modelo: 'Redmi Note 12', defeito: 'Câmera traseira não funciona', status: 'entregue', vServ: 200, dias: 8 },
      { marca: 'Apple', modelo: 'iPhone 14 Pro', defeito: 'Tela com mancha roxa', status: 'entregue', vServ: 450, dias: 7 },
      { marca: 'Samsung', modelo: 'Galaxy A54', defeito: 'Touch fantasma na tela', status: 'pronto', vServ: 220, dias: 5 },
      { marca: 'Motorola', modelo: 'Edge 40', defeito: 'Alto-falante não funciona', status: 'pronto', vServ: 120, dias: 4 },
      { marca: 'Apple', modelo: 'iPhone 12', defeito: 'Botão power travado', status: 'em_reparo', vServ: 180, dias: 3 },
      { marca: 'Samsung', modelo: 'Galaxy S22', defeito: 'Placa mãe com curto - não liga', status: 'em_reparo', vServ: 350, dias: 3 },
      { marca: 'Xiaomi', modelo: 'Poco X5', defeito: 'Tela trincada + touch não responde', status: 'em_reparo', vServ: 280, dias: 2 },
      { marca: 'Apple', modelo: 'iPhone 15', defeito: 'Face ID não reconhece', status: 'aguardando_peca', vServ: 300, dias: 2 },
      { marca: 'Samsung', modelo: 'Galaxy Z Flip 5', defeito: 'Dobradiça com folga', status: 'aguardando_peca', vServ: 400, dias: 1 },
      { marca: 'Motorola', modelo: 'Moto G53', defeito: 'Wi-Fi não conecta', status: 'aberta', vServ: 100, dias: 1 },
      { marca: 'Apple', modelo: 'iPhone 11', defeito: 'Vidro traseiro quebrado', status: 'aberta', vServ: 200, dias: 0 },
      { marca: 'Samsung', modelo: 'Galaxy A14', defeito: 'Não recebe sinal / sem rede', status: 'aberta', vServ: 150, dias: 0 },
      { marca: 'Xiaomi', modelo: 'Redmi 13C', defeito: 'Bateria inchada', status: 'aberta', vServ: 130, dias: 0 },
      { marca: 'Apple', modelo: 'iPhone SE 3', defeito: 'Microfone não funciona em ligação', status: 'aberta', vServ: 160, dias: 0 },
      { marca: 'Motorola', modelo: 'Moto G Power', defeito: 'Tela escura mas vibra', status: 'em_reparo', vServ: 190, dias: 1 },
      { marca: 'Samsung', modelo: 'Galaxy S21 FE', defeito: 'Sensor de digital não funciona', status: 'cancelada', vServ: 0, dias: 20 },
      { marca: 'Apple', modelo: 'iPhone XR', defeito: 'Infiltração de líquido', status: 'cancelada', vServ: 0, dias: 18 },
    ];

    const osIds = [];
    for (let i = 0; i < osData.length; i++) {
      const os = osData[i];
      const num = `OS${yyyy}${String(i + 1).padStart(5, '0')}`;
      const cid = clienteIds[i % clienteIds.length];
      const tid = tecnicoIds[i % tecnicoIds.length];
      const dataEntrada = daysAgo(os.dias);
      const dataConclusao = ['entregue', 'pronto'].includes(os.status) ? daysAgo(Math.max(os.dias - 2, 0)) : null;
      const dataEntrega = os.status === 'entregue' ? daysAgo(Math.max(os.dias - 3, 0)) : null;
      const fp = ['Pix', 'Cartão Crédito', 'Dinheiro', 'Cartão Débito'][i % 4];

      const { rows } = await client.query(
        `INSERT INTO ordens_servico (numero,cliente_id,tecnico_id,aparelho_marca,aparelho_modelo,defeito_relatado,status,valor_servico,valor_total,forma_pagamento,data_entrada,data_conclusao,data_entrega,criado_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12,$10) RETURNING id`,
        [num, cid, tid, os.marca, os.modelo, os.defeito, os.status, os.vServ, fp, dataEntrada, dataConclusao, dataEntrega]
      );
      osIds.push(rows[0].id);
    }

    // Add pecas to some OS
    console.log('Adicionando peças às OS...');
    if (telas.length > 0) {
      for (let i = 0; i < 5 && i < osIds.length && i < telas.length; i++) {
        const pv = Number(telas[i].preco_venda);
        await client.query(
          'INSERT INTO os_pecas (ordem_id,produto_id,quantidade,preco_unitario,subtotal) VALUES ($1,$2,1,$3,$3)',
          [osIds[i], telas[i].id, pv]
        );
        await client.query('UPDATE ordens_servico SET valor_pecas=$1, valor_total=valor_servico+$1 WHERE id=$2', [pv, osIds[i]]);
      }
    }

    // ── Vendas ──
    console.log('Criando vendas...');
    const formasPag = ['Pix', 'Cartão Crédito', 'Cartão Débito', 'Dinheiro'];
    for (let v = 0; v < 10; v++) {
      const fp = formasPag[v % 4];
      const cid = clienteIds[v % clienteIds.length];
      const criadoEm = daysAgo(Math.floor(Math.random() * 14));
      const { rows: [venda] } = await client.query(
        'INSERT INTO vendas (cliente_id,usuario_id,forma_pagamento,criado_em) VALUES ($1,$2,$3,$4) RETURNING id',
        [cid, adminId, fp, criadoEm]
      );
      let total = 0;
      const numItens = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < numItens && j < acessorios.length; j++) {
        const acc = acessorios[(v * 3 + j) % acessorios.length];
        const qty = Math.floor(Math.random() * 2) + 1;
        const pv = Number(acc.preco_venda);
        const sub = pv * qty;
        total += sub;
        await client.query(
          'INSERT INTO venda_itens (venda_id,produto_id,quantidade,preco_unitario,subtotal) VALUES ($1,$2,$3,$4,$5)',
          [venda.id, acc.id, qty, pv, sub]
        );
      }
      await client.query('UPDATE vendas SET valor_total=$1 WHERE id=$2', [total, venda.id]);
    }

    // ── Caixa ──
    console.log('Criando caixas...');
    // Closed caixa from yesterday
    const { rows: [caixaOntem] } = await client.query(
      `INSERT INTO caixa (usuario_id,data_abertura,data_fechamento,valor_abertura,valor_fechamento,status)
       VALUES ($1,$2,$3,200,1850,'fechado') RETURNING id`,
      [adminId, daysAgo(1), daysAgo(0)]
    );
    // Movements for yesterday's caixa
    const movsOntem = [
      ['entrada', 'Ordem de Serviço', 'OS entrega - iPhone 13', 370, 'Pix'],
      ['entrada', 'Ordem de Serviço', 'OS entrega - Galaxy S23', 180, 'Cartão Crédito'],
      ['entrada', 'Venda balcão', 'Venda #1 - Capinhas e películas', 85, 'Dinheiro'],
      ['entrada', 'Venda balcão', 'Venda #2 - Cabo + fone', 120, 'Pix'],
      ['entrada', 'Ordem de Serviço', 'OS entrega - Moto G84', 150, 'Dinheiro'],
      ['saida', 'Troco', 'Troco cliente', 50, 'Dinheiro'],
      ['saida', 'Despesa', 'Material de limpeza', 25, 'Dinheiro'],
      ['entrada', 'Venda balcão', 'Venda #3 - Carregador turbo', 95, 'Cartão Débito'],
      ['entrada', 'Ordem de Serviço', 'OS entrega - Redmi Note 12', 200, 'Pix'],
      ['entrada', 'Ordem de Serviço', 'OS entrega - iPhone 14 Pro', 450, 'Cartão Crédito'],
      ['saida', 'Despesa', 'Almoço equipe', 75, 'Pix'],
    ];
    for (const [tipo, cat, desc, valor, fp] of movsOntem) {
      await client.query(
        `INSERT INTO movimentacoes_caixa (caixa_id,tipo,categoria,descricao,valor,forma_pagamento,referencia_tipo,criado_em)
         VALUES ($1,$2,$3,$4,$5,$6,'manual',$7)`,
        [caixaOntem.id, tipo, cat, desc, valor, fp, daysAgo(1)]
      );
    }

    // Today's open caixa
    const { rows: [caixaHoje] } = await client.query(
      `INSERT INTO caixa (usuario_id,valor_abertura,status) VALUES ($1,200,'aberto') RETURNING id`,
      [adminId]
    );
    const movsHoje = [
      ['entrada', 'Ordem de Serviço', 'OS manutenção - Galaxy A54', 220, 'Pix'],
      ['entrada', 'Venda balcão', 'Venda películas + capinha', 65, 'Dinheiro'],
      ['saida', 'Troco', 'Troco cliente', 35, 'Dinheiro'],
    ];
    for (const [tipo, cat, desc, valor, fp] of movsHoje) {
      await client.query(
        'INSERT INTO movimentacoes_caixa (caixa_id,tipo,categoria,descricao,valor,forma_pagamento,referencia_tipo) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [caixaHoje.id, tipo, cat, desc, valor, fp, 'manual']
      );
    }

    // ── Contas ──
    console.log('Criando contas a pagar/receber...');
    const contas = [
      ['receber', `OS OS${yyyy}00001 - Apple iPhone 13`, 370, daysAgo(15), daysAgo(13), 'pago', 'Ordem de Serviço'],
      ['receber', `OS OS${yyyy}00002 - Samsung Galaxy S23`, 180, daysAgo(12), daysAgo(10), 'pago', 'Ordem de Serviço'],
      ['receber', `OS OS${yyyy}00003 - Motorola Moto G84`, 150, daysAgo(10), daysAgo(8), 'pago', 'Ordem de Serviço'],
      ['receber', `OS OS${yyyy}00004 - Xiaomi Redmi Note 12`, 200, daysAgo(8), daysAgo(6), 'pago', 'Ordem de Serviço'],
      ['receber', `OS OS${yyyy}00005 - Apple iPhone 14 Pro`, 450, daysAgo(7), daysAgo(5), 'pago', 'Ordem de Serviço'],
      ['receber', 'Venda balcão #1', 85, daysAgo(5), daysAgo(5), 'pago', 'Venda Balcão'],
      ['receber', 'Venda balcão #2', 120, daysAgo(4), daysAgo(4), 'pago', 'Venda Balcão'],
      ['receber', 'Venda balcão #3', 95, daysAgo(3), daysAgo(3), 'pago', 'Venda Balcão'],
      ['receber', `OS OS${yyyy}00006 - Samsung Galaxy A54`, 220, daysAgo(0), null, 'pendente', 'Ordem de Serviço'],
      ['receber', `OS OS${yyyy}00007 - Motorola Edge 40`, 120, daysAgo(0), null, 'pendente', 'Ordem de Serviço'],
      ['pagar', 'Aluguel - Novembro', 2500, daysAgo(5), daysAgo(5), 'pago', 'Aluguel'],
      ['pagar', 'Energia elétrica - Outubro', 450, daysAgo(20), daysAgo(18), 'pago', 'Energia'],
      ['pagar', 'Internet fibra', 150, daysAgo(10), daysAgo(10), 'pago', 'Internet'],
      ['pagar', 'Fornecedor TechParts - NF 4521', 1200, daysAgo(7), daysAgo(5), 'pago', 'Fornecedor'],
      ['pagar', 'Fornecedor CellPeças - NF 892', 800, daysAgo(3), null, 'pendente', 'Fornecedor'],
      ['pagar', 'Contador - Honorários', 350, daysAgo(0), null, 'pendente', 'Contador'],
      ['pagar', 'Água - Novembro', 80, dateStr(daysAgo(-5)), null, 'pendente', 'Água'],
      ['pagar', 'Telefone', 120, dateStr(daysAgo(-3)), null, 'pendente', 'Telefone'],
      ['pagar', 'Seguro loja', 180, dateStr(daysAgo(-10)), null, 'pendente', 'Seguro'],
      ['pagar', 'Energia elétrica - Novembro', 480, dateStr(daysAgo(-8)), null, 'pendente', 'Energia'],
    ];
    for (const [tipo, desc, valor, venc, pgto, st, cat] of contas) {
      const vencDate = typeof venc === 'string' ? venc : dateStr(venc);
      const pgtoDate = pgto ? dateStr(pgto) : null;
      await client.query(
        'INSERT INTO contas (tipo,descricao,valor,data_vencimento,data_pagamento,status,categoria) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [tipo, desc, valor, vencDate, pgtoDate, st, cat]
      );
    }

    // ── Compras ──
    console.log('Criando compras de fornecedores...');
    const fornecedores = [
      { nome: 'TechParts Distribuidora', valor: 1200, status: 'pago', dias: 10 },
      { nome: 'CellPeças Brasil', valor: 800, status: 'pago', dias: 7 },
      { nome: 'MobileStock SP', valor: 650, status: 'pendente', dias: 3 },
      { nome: 'TechParts Distribuidora', valor: 950, status: 'pendente', dias: 1 },
      { nome: 'AcessóriosMix', valor: 420, status: 'pago', dias: 14 },
    ];
    for (const forn of fornecedores) {
      const dc = daysAgo(forn.dias);
      const dp = forn.status === 'pago' ? daysAgo(forn.dias - 1) : null;
      const { rows: [compra] } = await client.query(
        'INSERT INTO compras (fornecedor,data_compra,valor_total,status,data_pagamento,forma_pagamento) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [forn.nome, dc, forn.valor, forn.status, dp, 'Pix']
      );
      // Add 2-3 items per purchase
      const prodList = [...telas.slice(0, 3), ...baterias.slice(0, 2)];
      const numItens = Math.min(2 + Math.floor(Math.random() * 2), prodList.length);
      for (let j = 0; j < numItens; j++) {
        const p = prodList[j];
        const qty = Math.floor(Math.random() * 3) + 1;
        const pu = Number(p.preco_venda) * 0.4;
        await client.query(
          'INSERT INTO compra_itens (compra_id,produto_id,quantidade,preco_unitario,subtotal) VALUES ($1,$2,$3,$4,$5)',
          [compra.id, p.id, qty, pu, pu * qty]
        );
      }
    }

    // ── Custos Fixos ──
    console.log('Criando custos fixos...');
    const custos = [
      ['Aluguel da loja', 2500, 5, 'Aluguel'],
      ['Energia elétrica', 450, 15, 'Energia'],
      ['Internet fibra óptica', 150, 10, 'Internet'],
      ['Água / Saneamento', 80, 20, 'Água'],
      ['Telefone / Celular', 120, 12, 'Telefone'],
      ['Contador - Honorários', 350, 10, 'Contador'],
      ['Software de gestão', 99, 1, 'Software'],
      ['Seguro da loja', 180, 25, 'Seguro'],
    ];
    for (const [desc, valor, dia, cat] of custos) {
      await client.query(
        'INSERT INTO custos_fixos (descricao,valor,dia_vencimento,categoria) VALUES ($1,$2,$3,$4)',
        [desc, valor, dia, cat]
      );
    }

    await client.query('COMMIT');
    console.log('\n✅ Seed completo!');
    console.log('  - 15 clientes');
    console.log('  - 20 ordens de serviço');
    console.log('  - 10 vendas');
    console.log('  - 2 caixas (1 fechado + 1 aberto)');
    console.log('  - 20 contas (pagar/receber)');
    console.log('  - 5 compras de fornecedores');
    console.log('  - 8 custos fixos');
    console.log('  - 2 usuários extras (lucas / camila)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro no seed:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
