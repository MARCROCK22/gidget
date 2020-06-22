const { bot } = require("../index.js");
const MessageModel = require('../database/models/muterole.js');
const MessageModel2 = require('../database/models/mutedmembers.js');
let i = 0;
let cache;

module.exports = async (reupdate = false) => {
  if(i === 1 && reupdate) {
    i = 0;
    clearInterval(interval);
  }
  if (i === 0) {
    i++;
    var interval = setInterval(async () => {
   let msgDocument;
      if (cache && !reupdate) {
        msgDocument = cache;
      } else {
        msgDocument = await MessageModel2.find();
        cache = msgDocument;
        reupdate = false;
      }
  let test = msgDocument[0];
  if (test) {
    for (let i in msgDocument) {
      let date = msgDocument[i].date.getTime();
      if (new Date().getTime() >= date) {
        let another = await MessageModel.findOne({
          guildid: msgDocument[i].guildId
        });
        if (another) {
          let guild = bot.guilds.cache.get(msgDocument[i].guildId);
          if (guild) {
            let role = guild.roles.cache.get(another.muteroleid);
            let member = guild.members.cache.get(msgDocument[i].memberId) || msgDocument[i].memberId ? await guild.members.fetch(msgDocument[i].memberId) : undefined;
            if (role && member) {
              member.roles.remove(role, "Temprestrict - Time over.");
            }
          }
        }
        msgDocument[i].deleteOne();
        reupdate = true;
      }
    }
  } else {
    i = 0;
    cache = undefined;
    clearInterval(interval);
  }
  }, 5000);
  }
};