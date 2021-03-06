const COOKIE = process.env.COOKIETEXT;
import ytdl from "discord-ytdl-core";
import yts from 'yt-search';
import ytpl from 'ytpl';
import moment from "moment";
// Autocomplete
// eslint-disable-next-line no-unused-vars
import Discord from 'discord.js';
import "moment-duration-format";
export default class extends Command {
  constructor(options) {
    super(options);
    this.aliases = ["join", "p"];
    this.description = "Play music from YouTube";
    this.guildonly = true;
  }
  async run(bot, message, args, seek = false) {
    //No arguments
    if (!args[1]) return message.channel.send("Please enter a YouTube link or search term.");

    //In where the bot is going to connect?
    const eeee = message.member.voice.channel;
    if (!eeee) return message.channel.send("You need to be in a voice channel to play music!");
    const voiceChannel = await message.guild.channels.fetch(message.member.voice.channelID);
    //See if a music system is already executing
    const serverQueue = message.guild.queue;
    if (serverQueue) {
      //If that's the case check if voice channels are equal
      if (serverQueue.voiceChannel.id !== voiceChannel.id) return message.channel.send("I'm on another voice channel! I cannot be on two channels at the same time.");
    }

    const permissions = voiceChannel.permissionsFor(bot.user.id);

    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) return message.channel.send("I need the permissions to join and speak in your voice channel!");

    if (message.guild.afkChannelID === voiceChannel.id) return message.channel.send("I cannot play music on an AFK channel.");

    let musicVariables = message.guild.musicVariables;

    if (musicVariables && musicVariables.other) return message.channel.send("I'm doing another operation");

    if (!musicVariables) {
      message.guild.musicVariables = {
        perror: 0,
        memberVoted: [],
        i: 0,
        o: 0,
        time: null,
        time1: null,
        other: false
      };

      musicVariables = message.guild.musicVariables;
    }

    if (seek) {
      //Only for seek command...
      return await play(message.guild, serverQueue.songs[0]);
    } else if (ytdl.validateURL(args[1])) {
      if (serverQueue) {
        if (serverQueue.loop) {
          serverQueue.loop = false;
          message.channel.send("🔁 The song repeat has been disabled.");
        }
      }
      message.channel.startTyping();
      return handleServerQueue(serverQueue, message.channel, voiceChannel, [{ url: args[1], handle: true }]).catch(err => {
        message.channel.send("Error: " + err);
      });
    } else if (ytdl.validateID(args[1])) {
      if (serverQueue) {
        if (serverQueue.loop) {
          serverQueue.loop = false;
          message.channel.send("🔁 The song repeat has been disabled.");
        }
      }
      message.channel.startTyping();
      return handleServerQueue(serverQueue, message.channel, voiceChannel, [{ url: "https://www.youtube.com/watch?v=" + args[1], handle: true }]).catch(err => {
        message.channel.send("Error: " + err);
      });
    } else if (ytpl.validateID(args[1])) {
      message.channel.startTyping();
      try {
        const playlist = await ytpl(args[1]);
        const videos = playlist.items;
        message.channel.startTyping(playlist.items.length - 1);
        if (serverQueue) {
          if (serverQueue.loop) {
            serverQueue.loop = false;
            message.channel.send("🔁 The song repeat has been disabled.");
          }
        }
        const songs = videos.filter(e => e.isPlayable).map(e => {
          return {
            url: e.shortUrl,
            title: e.title,
            duration: e.durationSec,
            seektime: 0
          };
        });
        await handleServerQueue(serverQueue, message.channel, voiceChannel, songs, true);
        message.channel.stopTyping(true);
        message.channel.send(`Playlist: **${playlist.title}** has been added to the queue (${playlist.items.length} songs)!`);
      } catch (err) {
        if (!serverQueue) message.guild.musicVariables = null;
        message.channel.stopTyping(true);
        message.channel.send("I couldn't queue your playlist. Here's a debug: " + err);
      }
    } else {
      try {
        message.channel.startTyping();
        const res = await yts({ query: args.slice(1).join(" ") });
        if (!res) return message.channel.send("I didn't find any video. Please try again with another term.");
        const vids = res.videos;
        const video = vids[0];
        if (!video) return message.channel.send("I didn't find any video. Please try again with another term.");
        await handleServerQueue(serverQueue, message.channel, voiceChannel, [{ url: video.url, title: video.title, duration: video.duration.seconds, seektime: 0 }]);
      } catch (err) {
        if (!serverQueue) message.guild.musicVariables = null;
        message.channel.stopTyping(true);
        message.channel.send("Some error ocurred. Here's a debug: " + err);
      }
    }
  }
}

/**
 * Get the necessary YouTube video info. Don't use this if another API is helping you on that.
 *
 * @param {string} URL - The YouTube video URL.
 * @returns {object} The video object ready to push to the queue.
 */
async function handleVideo(url) {
  const songInfo = await ytdl.getBasicInfo(url, {
    requestOptions: {
      headers: {
        cookie: COOKIE
      },
    },
  });
  const opts = new URL(url);
  const song = {
    title: songInfo.videoDetails.title,
    url: songInfo.videoDetails.video_url,
    duration: songInfo.videoDetails.lengthSeconds,
    seektime: ((opts.searchParams.get("t")?.length < 8) ? opts.searchParams.get("t") : 0) || 0
  };
  return song;
}

/**
 * @param {object} serverQueue
 * @param {Discord.TextChannel} textChannel
 * @param {Discord.VoiceChannel} voiceChannel
 * @param {object[]} pre_songs
 * @param {boolean} playlist
 * @returns {Promise<void>}
 */
async function handleServerQueue(serverQueue, textChannel, voiceChannel, pre_songs, playlist = false) {
  const songs = [];
  for (const pre_song of pre_songs) {
    let song = pre_song;
    if (pre_song.handle) {
      song = await handleVideo(pre_song.url);
    }
    songs.push(song);
  }
  if (!serverQueue) {
    const queueConstruct = {
      textChannel: textChannel,
      voiceChannel: voiceChannel,
      connection: null,
      songs,
      volume: 5,
      playing: true,
      loop: false,
      inseek: false,
    };

    voiceChannel.guild.queue = queueConstruct;

    try {
      const connection = await voiceChannel.join();
      if (connection.voice.mute) {
        setTimeout(() => {
          voiceChannel.leave();
        }, 10000);
        connection.channel.guild.queue = null;
        connection.channel.guild.musicVariables = null;
        textChannel.stopTyping();
        textChannel.send("Sorry, but I'm muted. Contact an admin to unmute me.");
        return;
      }
      queueConstruct.connection = connection;
      await play(connection.channel.guild, queueConstruct.songs[0]);
      textChannel.stopTyping();
    } catch (error) {
      console.error(error);
      voiceChannel.leave();
      voiceChannel.guild.queue = null;
      voiceChannel.guild.musicVariables = null;
      textChannel.stopTyping();
      textChannel.send("I could not join the voice channel. To prevent the bot from turning off the queue has been removed. Here's a debug: " + error);
      return;
    }
  } else {
    for (const s of songs) {
      serverQueue.songs.push(s);
    }
    if (!playlist) {
      textChannel.stopTyping();
      textChannel.send(`**${songs[0].title}** has been added to the queue!`);
    }
  }
  return;
}

async function play(guild, song) {
  const serverQueue = guild.queue;
  const musicVariables = guild.musicVariables;

  if (!song) {
    if (serverQueue) {
      if (serverQueue.textChannel) {
        serverQueue.textChannel.stopTyping();
      }
      if (serverQueue.voiceChannel) {
        serverQueue.voiceChannel.leave();
      }
    }
    guild.queue = null;
    guild.musicVariables = null;
    return;
  }
  try {
    if (!song.duration) {
      const thing = await handleVideo(song.url);
      serverQueue.songs[0] = thing;
      song = thing;
    }
    const ytstream = ytdl(song.url, { filter: 'audioonly', opusEncoded: true, highWaterMark: 1 << 25, seek: song.seektime, requestOptions: { headers: { cookie: COOKIE } } });
    const dispatcher = serverQueue.connection.play(ytstream, { type: "opus", bitrate: 'auto' });
    dispatcher.on("error", async err => {
      console.error(err);
      musicVariables.memberVoted = [];
      serverQueue.songs.shift();
      await serverQueue.textChannel
        .send("An error occurred with the dispatcher. " + err)
        .catch(() => { });
      if (!serverQueue.playing) serverQueue.playing = true;
      await play(guild, serverQueue.songs[0]);
    });
    dispatcher.on("start", () => {
      dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
      if (serverQueue.inseek) {
        serverQueue.inseek = false
        serverQueue.textChannel.stopTyping();
        return serverQueue.textChannel.send("Position moved to " + moment.duration(song.seektime, "seconds").format()).catch(() => { });
      }
      if (!serverQueue.loop)
        serverQueue.textChannel.send(
          `<:JukeboxRobot:610310184484732959> Now playing: **${song.title}**`
        ).catch(() => { });
      serverQueue.textChannel.stopTyping(true);
    });
    dispatcher.on("finish", async () => {
      if (serverQueue.inseek) return;
      musicVariables.memberVoted = [];
      if(serverQueue.loop) {
        if(serverQueue.loop?.shuffle) serverQueue.loop = false;
        song.seektime = 0;
      } else serverQueue.songs.shift();
      if (!serverQueue.playing) serverQueue.playing = true;
      await play(guild, serverQueue.songs[0]);
    });
    dispatcher.on("close", () => {
      if (serverQueue.inseek) return;
      if (!guild.me.voice.channel) {
        clearTimeout(musicVariables.time);
        if (serverQueue.textChannel) {
          serverQueue.textChannel.stopTyping();
        }
        if (serverQueue.voiceChannel) {
          serverQueue.voiceChannel.leave();
        }
        guild.queue = null;
        guild.musicVariables = null;
        return;
      }
    });
  } catch (err) {
    musicVariables.memberVoted = [];
    serverQueue.songs.shift();
    if (serverQueue.textChannel) {
      serverQueue.textChannel.stopTyping();
      console.log(err);
      await serverQueue.textChannel
        .send("An error ocurred with the YouTube stream: " + err)
        .catch(err => console.log(err));
    }
    if (!serverQueue.playing) serverQueue.playing = true;
    await play(guild, serverQueue.songs[0]);
  }
}
