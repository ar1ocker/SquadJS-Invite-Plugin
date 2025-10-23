//@ts-check
import BasePlugin from "./base-plugin.js";
import { default as PlaytimeServiceAPI, TIME_IS_UNKNOWN } from "./playtime-service-api.js";

const SQUAD_GAME_ID = 393380;

//@ts-ignore
export default class InviteToSquad extends BasePlugin {
  static get description() {
    return "The plugin to send invite to squad leader";
  }

  static get defaultEnabled() {
    return false;
  }

  static get optionsSpecification() {
    return {
      playtime_service_api_url: {
        required: true,
        description: "URL to Playtime Service API",
        default: "",
      },
      playtime_service_api_secret_key: {
        required: true,
        description: "Secret key for Playtime Service API",
        default: "",
      },
      commands: {
        required: false,
        description: "Commands to invite to squad leader",
        default: ["invite", "inv", "please", "инвайт", "инв", "штм"],
      },
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);

    this.playtimeAPI = new PlaytimeServiceAPI(
      this.options.playtime_service_api_url,
      this.options.playtime_service_api_secret_key,
      SQUAD_GAME_ID
    );

    this.sendMessageToPlayer = this.sendMessageToPlayer.bind(this);
  }

  async mount() {
    for (const index in this.options.commands) {
      this.server.on(`CHAT_COMMAND:${this.options.commands[index]}`, (data) => {
        if (data.message && data.player) {
          this.sendMessageToPlayer(data);
        }
      });
    }
  }

  async sendMessageToPlayer(data) {
    if (data.player.squadID !== null) {
      await this.warn(data.player.steamID, "Вы и так уже в отряде");
      return;
    }

    const squadID = parseInt(data.message);

    if (!squadID) {
      await this.warn(data.player.steamID, "Введите номер сквада");
      return;
    }

    const squad = this.server.squads.find((squad) => squad.squadID === squadID && squad.teamID === data.player.teamID);

    if (!squad) {
      await this.warn(data.player.steamID, "Сквад в таким номером не найден");
      return;
    }

    if (squad.size == 9) {
      await this.warn(data.player.steamID, `Сквад с номером ${squadID} уже полный`);
      return;
    }

    const squadLeader = this.server.players.find(
      (player) => player.squadID === squadID && player.teamID === data.player.teamID && player.isLeader
    );

    if (!squadLeader) {
      await this.warn(
        data.player.steamID,
        `Не смогли найти сквадного отряда номер ${squadID}\nПовторите попытку позже`
      );
      return;
    }

    let playtime = TIME_IS_UNKNOWN;

    try {
      const playtimeSec = await this.playtimeAPI.getPlayerMaxSecondsPlaytime(data.player.steamID);
      if (playtimeSec !== TIME_IS_UNKNOWN) {
        //@ts-ignore
        playtime = playtimeSec / 60 / 60;
      }
    } catch (error) {
      this.verbose(1, `Failed to get player max seconds playtime: ${error.message}`);
    }

    if (playtime === TIME_IS_UNKNOWN) {
      await this.warn(squadLeader.steamID, `В сквад просится ${data.player.name}`);
    } else {
      await this.warn(
        squadLeader.steamID,
        `В сквад просится ${data.player.name}\nВремя в игре ${playtime.toFixed(0)} часов`
      );
    }

    await this.warn(data.player.steamID, `Ваша просьба отправлена сквадному ${squadLeader.name}`);
  }

  async warn(playerID, message, repeat = 1, frequency = 5) {
    for (let i = 0; i < repeat; i++) {
      await this.server.rcon.warn(playerID, message + "\u{00A0}".repeat(i));

      if (i !== repeat - 1) {
        await new Promise((resolve) => setTimeout(resolve, frequency * 1000));
      }
    }
  }
}
