import BOATS from 'boats.js';
export default async function(sharder) {
    const Boats = new BOATS(process.env.DISCORDBOATS, "v2");
    const posted = await Boats.postStats((await sharder.fetchClientValues('guilds.cache.size')).reduce((acc, guildCount) => acc + guildCount, 0), "694306281736896573");
    console.log("discord.boats: Server count posted!");
    return posted;
}