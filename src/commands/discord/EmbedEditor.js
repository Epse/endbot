"use strict";

const Discord = require("discord.js");

const Command = require("../Command.js");

/*
Here are all the regex used for the arguments:
	/^"([^"]+|.*\\".*)"$/: Only a string enclosed by ", which can be escaped with \
 */

class EmbedEditor extends Command {
	constructor(client) {
		super(client);
		this.info = {
			"name": "EmbedEditor Editor",
			"usage": "embed create",
			"description": "Creates and edits embeds"
		};
		this.ongoing = new Map();
	}

	run(message, args) {
		try {
			switch (args[0]) {
			case "create":
				this.create(message, args);
				break;

			case "delete":
				break;

			case "title":
				this.title(message, args.slice(1));
				break;

			case "description":
				this.description(message, args.slice(1));
				break;

			case "footer":
				this.footer(message, args.slice(1));
				break;

			case "color":
				this.color(message, args.slice(1));
				break;

			case "field":
				this.field(message, args.slice(1));
				break;

			default:
				if (!this.ongoing.has(message.author.id)) {
					message.channel.send(
						this.client.createEmbed("error")
							.setTitle("You don't have an ongoing embed! Do " + this.client.prefix + "embed create")
					);
					break;
				} else {
					message.channel.send(this.ongoing.get(message.author.id));
				}
				break;
			}
		} catch (e) {
			message.channel.send(
				this.client.errorEmbed("unexpected")
					.setDescription(e)
			);
		}
	}

	create(message, args) {
		let embed;
		switch (args[1]) {
		case "from":
			break;

		default:
			if (this.ongoing.has(message.author.id)) {
				message.channel.send(
					this.client.createEmbed("error")
						.setTitle("You already have an ongoing embed! Do " + this.client.prefix + "embed reset")
				);
				break;
			}
			embed = new Discord.MessageEmbed();
			this.ongoing.set(message.author.id, embed);
			message.channel.send(embed);
			break;
		}
	}

	setCheck(message, args) {
		if (args[0] == undefined) {
			message.channel.send(this.client.errorEmbed("args"));
			return true;
		} else if (!this.ongoing.has(message.author.id)) {
			message.channel.send(
				this.client.createEmbed("error")
					.setTitle("You don't have an ongoing embed! Do " + this.client.prefix + "embed create")
			);
			return false;
		} else {
			return true;
		}
	}

	title(message, args) {
		if (!this.setCheck(message, args)) return;
		let embed = this.ongoing.get(message.author.id);

		let title = args.join(" ");
		if (title.match(/^".*"$/s) != null) {
			embed.setTitle(title.substring(1, title.length-1));
			message.channel.send(embed);
		} else {
			message.channel.send(this.client.errorEmbed("args"));
		}
	}

	description(message, args) {
		if (!this.setCheck(message, args)) return;
		let embed = this.ongoing.get(message.author.id);

		let description = args.join(" ");
		if (description.match(/^".*"$/s) != null) {
			embed.setDescription(description.substring(1, description.length-1));
			message.channel.send(embed);
		} else {
			message.channel.send(this.client.errorEmbed("args"));
		}
	}

	footer(message, args) {
		if (!this.setCheck(message, args)) return;
		let embed = this.ongoing.get(message.author.id);

		let footer = args.join(" ");
		if (footer.match(/^".*"$/s) != null) {
			embed.setFooter(footer.substring(1, footer.length-1));
			message.channel.send(embed);
		} else {
			message.channel.send(this.client.errorEmbed("args"));
		}
	}

	color(message, args) {
		if (!this.setCheck(message, args)) return;
		let embed = this.ongoing.get(message.author.id);

		let color = args.join(" ");
		if (color.match(/^#?[0-9a-fA-F]{6}$/) != null) {
			embed.setColor(color);
			message.channel.send(embed);
		} else {
			message.channel.send(this.client.errorEmbed("args"));
		}
	}

	field(message, args) {
		if (!this.setCheck(message, args)) return;
		let embed = this.ongoing.get(message.author.id);

		if (args[0] == "add") {
			let result = args.slice(1).join(" ").match(/(^".*"),(".*"),(true|false)$/s);
			if (result != null) {
				let name = result[1];
				let value = result[2];
				let inline = result[3];
				embed.addField(
					name.substring(1, name.length - 1),
					value.substring(1, value.length - 1),
					inline
				);
				message.channel.send(embed);
			} else {
				message.channel.send(this.client.errorEmbed("args"));
			}
		} else if (args[0] == "splice") {
			let index = args.slice(1).join(" ");
			if (index.match(/^([0-9]|1[0-9]|2[0-6])$/) != null) {
				embed.spliceFields(index, 1);
				message.channel.send(embed);
			} else {
				message.channel.send(this.client.errorEmbed("args"));
			}
		} else {
			message.channel.send(this.client.errorEmbed("args"));
		}
	}

	toString() {
		return this.info;
	}
}

module.exports = EmbedEditor;