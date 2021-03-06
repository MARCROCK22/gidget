import ms from "ms";

export default class extends Command {
    constructor(options) {
        super(options);
        this.aliases = [];
        this.description = "Change the position of the stream";
        this.guildonly = true;
        this.permissions = {
            user: [0, 0],
            bot: [0, 0]
        };
    }
    async run(bot, message, args) {
        if (!args[1]) return message.channel.send("Usage: `seek <time>`\n`seek 1:30`");
        const serverQueue = message.guild.queue;
        if (!serverQueue) return message.channel.send("There is nothing playing.");

        const exp = args[1].split(":")
        //More support?
        const sec = exp[exp.length - 1]
        const min = exp[exp.length - 2] || "0"
        const hrs = exp[exp.length - 3] || "0"
        const reconverted = (ms(hrs + "h") / 1000) + (ms(min + "m") / 1000) + (ms(sec + "s") / 1000);
        if (isNaN(reconverted) || (typeof reconverted !== "number")) return message.channel.send("Invalid value!");

        if (!serverQueue || !serverQueue.songs[0]) return;
        if (!serverQueue.songs[0].duration) return message.channel.send("It's impossible for me to seek without a certain duration, sorry.");

        if (serverQueue.songs[0].duration <= (reconverted + 2)) return message.channel.send("The song is too short for the specified time!");

        if (reconverted < 0) return message.channel.send("Huh?");
        serverQueue.inseek = true;
        serverQueue.songs[0].seektime = reconverted;
        await message.channel.send("This may take a bit...");
        message.channel.startTyping();
        serverQueue.connection.dispatcher.end();
        await bot.commands.get("play").run(bot, message, ["play", "seek"], true).catch(err => message.channel.send("Error: " + err)).finally(() => message.channel.stopTyping(true))
    }
}
