import { authCheck } from './_auth.js';
function cors(res){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');}
export default async function handler(req,res){
  cors(res);
  if(req.method==='OPTIONS')return res.status(200).end();
  if(!await authCheck(req,res))return;
  return res.status(200).json({
    emailOk:!!(process.env.SMTP_USER&&process.env.SMTP_PASS&&process.env.MAIL_TO),
    mailTo:process.env.MAIL_TO||'',
    telegramOk:!!(process.env.TELEGRAM_TOKEN&&process.env.TELEGRAM_CHAT_ID),
    telegramChatId:process.env.TELEGRAM_CHAT_ID||'',
  });
}
