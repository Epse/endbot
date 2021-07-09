"use strict";

const { GoogleSpreadsheet } = require("google-spreadsheet");
const Discord = require("discord.js");
const { generate } = require("@util/embeds.js");

class Form {
	constructor(client) {
		this.client = client;
		this.config = this.client.moduleConfig["Application System"];
		this.url = this.config["form-url"];
		if (!this.url) throw new Error("No form url specified");
		this.doc = new GoogleSpreadsheet(this.url);
		this.totalApplications = 0;
		this.guild = this.client.guilds.cache.get(client.moduleConfig["Application System"]["guild-id"]);
		this.votingChannel = this.client.channels.cache.get(client.moduleConfig["Application System"]["voting-channel"]);
	}
	
	async load() {
		await this.doc.useServiceAccountAuth({
			client_email: this.config["client-email"],
			private_key: this.config["private-key"],
		});
		await this.doc.loadInfo();
		let sheet = this.doc.sheetsByIndex[0];
		
		// Fetches new submissions
		setInterval(async () => {
			let rows = await sheet.getRows();
			this.totalApplications = (await this.client.db.async_get("SELECT value FROM settings WHERE keyss = 'total_applications';")).value;

			if (this.totalApplications < rows.length) {
				rows.slice(this.totalApplications).forEach(async row => await this.createTicket(row));
			}
		}, 1000*10); // Every 30 seconds
	}
	
	async createTicket(row) {
		let { user, username, discriminator } = this.findUser(row);
		let ticketChannel = await this.createChannel(user, username);
		let url = await this.generateEmbed(row, ticketChannel, username);

		// this bug made be cry
		// https://stackoverflow.com/questions/4429319/you-cant-specify-target-table-for-update-in-from-clause
		await this.client.db.async_run(
			`INSERT INTO apps VALUES (?, ?, ?, ?, ?, ?, ?, ?,
			(SELECT COUNT(*) FROM (SELECT * FROM apps) as bonk WHERE username = ?), ?, ?);`,
			{ params: [
				ticketChannel.id,
				user ? user.user.id : null,
				username,
				discriminator,
				user ? user.user.displayAvatarURL({ format: "png" }) : null,
				url,
				parseInt(Date.now()),
				"pending",
				username, // duplicate
				"[]",
				"[]"
			]}
		);
	}
	
	findUser(row) {
		let tag = row["What is your Discord Tag?"].split("#");
		let username = tag[0];
		let discriminator = tag[1];
		let user;
		// Converts discord tag into User object
		this.guild.members.cache.forEach(member => {
			if ((member.nickname == username || member.user.username == username) && member.user.discriminator == discriminator) {
				user = member;
			}
		});
		return { user: user, username: username, discriminator: discriminator };
	}
	
	async createChannel(user, username) {
		// Creates the ticket with the right permissions
		let channel = await this.guild.channels.create(`${username}-ticket`, { 
			parent: this.client.moduleConfig["Application System"]["category-id"]
		});
		if (user) await channel.createOverwrite(user, { "VIEW_CHANNEL": true });
		else await channel.send(generate("warn").setTitle(`Couldn't find the user ${username}`));
		await this.client.db.async_run("UPDATE settings SET value = value + 1 WHERE keyss = 'total_applications'");
		return channel;
	}
	
	async generateEmbed(row, channel, username) {
		let info = [generate("endtech").setTitle(`${username}'s Application`)];
		let questions = [generate("endtech")];
		row._sheet.headerValues.forEach((question, i) => {
			if (!row[question] || i == 0) return;
			// Fix erroring out on accumulated embed size being over 6000,
			// but still assume that one Q+A combo will never be over 6000 characters
			// We do take 50 characters of margin here.
			if (i < 9) {
				if (info[info.length - 1].length + question.length + row[question].length >= 6000 - 50 ) {
					info.push(generate("endtech"));
				}
				info[info.length - 1].addField(`__${question}__`, row[question]);
			} else {
				if (questions[questions.length - 1].length + question.length + row[question].length >= 6000 - 50 ) {
					questions.push(generate("endtech"));
				}
				questions[questions.length - 1].addField(`__${question}__`, row[question]);
			}
		});
		let pinned = null;
		for (let i = 0; i < info.length; i++) {
			let result = await channel.send(info[0]);
			if (i == 0) {
				pinned = result;
			}
		}

		await channel.send(questions);
		for (question of questions) {
			await channel.send(question);
		}
		await pinned.pin();
		// await this.votingChannel.send(info.setDescription(`Click [here](${pinned.url}) to access the full application`));
		return pinned.url;
	}
}

module.exports = Form;
