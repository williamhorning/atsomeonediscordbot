import {
  Client,
  WebhookClient,
  Intents,
} from 'discord.js';
import { config } from 'dotenv';
import { KVNamespace } from '@miniflare/kv';
import { FileStorage } from '@miniflare/storage-file';

config();

const kv = new KVNamespace(new FileStorage('./kv'));

const client = new Client({
  intents:
    Intents.FLAGS.GUILD_MEMBERS |
    Intents.FLAGS.GUILD_MESSAGES |
    Intents.FLAGS.GUILD_WEBHOOKS |
    Intents.FLAGS.GUILDS,
});

async function getUsers(kv) {
  return JSON.parse(await kv.get('users'))
}

async function getRandomMember(msg, kv) {
  let user = (await msg.guild.members.fetch()).random();
  if ((await getUsers(kv)).includes(user.id)) {
    return user.toString();
  } else {
    return user.nickname || user.user.username;
  }
}

client.on('messageCreate', async (msg) => {
  try {
    if (msg.author.bot) return;
    let webhookurl = await kv.get(msg.channelId);
    if (webhookurl) {
      let webhook = new WebhookClient(
        { url: webhookurl },
        { allowedMentions: { users: await getUsers(kv) } }
      );
      if (msg.cleanContent.startsWith('!story unsetup')) {
        await kv.delete(msg.channelId);
      } else if (msg.cleanContent.startsWith('//')) {
        webhook.send({
          username: `${msg.author.username} (comment)`,
          content: msg.cleanContent.slice(2),
          avatarURL: msg.author.avatarURL(),
        });
        msg.delete();
      } else if (msg.cleanContent.startsWith('!story mentionme')){
        console.log(await getUsers(kv))
        if ((await getUsers(kv)).includes(msg.author.id)) {
          await kv.put('users', JSON.stringify(
            (await getUsers(kv)).filter((value)=>{
              return value !== msg.author.id
            })
          ))
        } else {
          let array = await getUsers(kv)
          array.push(msg.author.id)
          await kv.put('users', JSON.stringify(array))
        }
      } else {
        let content = msg.cleanContent;
        while (content.includes('@someone')) {
          content = content.replace('@someone', await getRandomMember(msg, kv));
          console.log(content)
        }
        webhook.send({
          username: msg.author.username,
          content: content || '',
          avatarURL: msg.author.avatarURL(),
        });
        msg.delete();
      }
    } else if (msg.cleanContent.startsWith('!story setup')) {
      await kv.put(
        msg.channelId,
        (
          await msg.channel.createWebhook('@story bot')
        ).url
      );
    }
  } catch (e) {
    msg.reply(`the bot encountered an error:\n\`\`\`${e}\`\`\``);
  }
});

client.login(process.env.DISCORD_TOKEN);
