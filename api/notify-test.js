import { authCheck } from './_auth.js';
function cors(res){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');}
export default async function handler(req,res){
  cors(res);
  if(req.method==='OPTIONS')return res.status(200).end();
  if(!await authCheck(req,res))return;
  if(req.method!=='POST')return res.status(405).end();

  const results=[];

  // Telegram
  if(process.env.TELEGRAM_TOKEN&&process.env.TELEGRAM_CHAT_ID){
    try{
      const r=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({chat_id:process.env.TELEGRAM_CHAT_ID,text:'🔔 *Cerne* — notificação de teste enviada com sucesso!',parse_mode:'Markdown'}),
      });
      results.push(r.ok?'Telegram ✓':'Telegram ✗ HTTP '+r.status);
    }catch(e){results.push('Telegram ✗ '+e.message);}
  }else{results.push('Telegram: TELEGRAM_TOKEN/TELEGRAM_CHAT_ID não configurados no Vercel');}

  // Email via nodemailer (se disponível)
  if(process.env.SMTP_USER&&process.env.SMTP_PASS&&process.env.MAIL_TO){
    try{
      const nodemailer=(await import('nodemailer')).default;
      const tr=nodemailer.createTransport({service:'gmail',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
      await tr.sendMail({from:`"Cerne" <${process.env.SMTP_USER}>`,to:process.env.MAIL_TO,subject:'🔔 Cerne — teste de notificação',text:'Notificação de teste enviada pelo Cerne. Tudo configurado corretamente!'});
      results.push('E-mail ✓');
    }catch(e){results.push('E-mail ✗ '+e.message);}
  }else{results.push('E-mail: SMTP_USER/SMTP_PASS/MAIL_TO não configurados no Vercel');}

  return res.status(200).json({message:results.join(' | '),results});
}
