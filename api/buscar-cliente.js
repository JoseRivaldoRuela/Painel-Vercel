export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  const { query } = req.body;
  if (!query) { res.status(400).json({ error: 'query obrigatória' }); return; }

  const GOOGLE_KEY = process.env.GOOGLE_API_KEY;
  const GOOGLE_CX = process.env.GOOGLE_CX;

  try {
    const cnpjLimpo = query.replace(/\D/g, '');

    if (cnpjLimpo.length === 14) {
      const resultado = await buscarPorCNPJ(cnpjLimpo);
      res.status(200).json({ resultados: resultado ? [resultado] : [] });
      return;
    }

    // Busca por nome via Google
    if (GOOGLE_KEY && GOOGLE_CX) {
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query + ' CNPJ')}&num=3&gl=br`;
      const sr = await fetch(searchUrl);
      const sd = await sr.json();
      if (sd.items?.length > 0) {
        const cnpjs = [];
        sd.items.forEach(item => {
          const m = (item.snippet + item.title).match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g);
          if (m) cnpjs.push(...m.map(c => c.replace(/\D/g, '')));
        });
        if (cnpjs.length > 0) {
          const resultado = await buscarPorCNPJ(cnpjs[0]);
          if (resultado) { res.status(200).json({ resultados: [resultado] }); return; }
        }
      }
    }

    res.status(200).json({ resultados: [] });
  } catch (e) {
    res.status(500).json({ error: e.message, resultados: [] });
  }
}

async function buscarPorCNPJ(cnpj) {
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (r.ok) {
      const d = await r.json();
      return {
        razao_social: d.razao_social,
        nome_fantasia: d.nome_fantasia || d.razao_social,
        cpf_cnpj: cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'),
        telefone: d.ddd_telefone_1 ? formatTel(d.ddd_telefone_1) : null,
        email: d.email || null,
        endereco: d.logradouro || null,
        numero: d.numero || null,
        bairro: d.bairro || null,
        cidade: d.municipio || null,
        estado: d.uf || null,
        cep: d.cep ? d.cep.replace(/(\d{5})(\d{3})/, '$1-$2') : null,
        observacoes: d.cnae_fiscal_descricao || null
      };
    }
    // Fallback ReceitaWS
    const r2 = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`);
    if (r2.ok) {
      const d = await r2.json();
      if (d.status !== 'ERROR') return {
        razao_social: d.nome,
        nome_fantasia: d.fantasia || d.nome,
        cpf_cnpj: cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'),
        telefone: d.telefone || null,
        email: d.email || null,
        endereco: d.logradouro || null,
        numero: d.numero || null,
        bairro: d.bairro || null,
        cidade: d.municipio || null,
        estado: d.uf || null,
        cep: d.cep ? d.cep.replace(/(\d{5})(\d{3})/, '$1-$2') : null,
        observacoes: d.atividade_principal?.[0]?.text || null
      };
    }
    return null;
  } catch { return null; }
}

function formatTel(t) {
  t = t.replace(/\D/g, '');
  if (t.length === 11) return t.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (t.length === 10) return t.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return t;
}
