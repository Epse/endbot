"use strict";

const { GoogleSpreadsheet } = require("google-spreadsheet");
const Discord = require("discord.js");

class Form {
	constructor(client) {
		this.client = client;
		this.config = this.client.moduleConfig["Application System"];
		this.url = this.config["form-url"];
		if (!this.url) throw new Error("No form url specified");
		this.doc = new GoogleSpreadsheet(this.url);
		this.totalApplications = 0;
		this.guild = this.client.guilds.cache.get(client.moduleConfig["Application System"]["guild-id"]);
	}
	
	async load() {
		await this.doc.useServiceAccountAuth({
			client_email: this.config["client-email"],
			private_key: this.config["private-key"],
		});
		await this.doc.loadInfo();
		let sheet = this.doc.sheetsByIndex[0];
		let rows = await sheet.getRows();
		this.totalApplications = (await this.client.db.async_get("SELECT value FROM settings WHERE key = \"total_applications\"")).value;
		
		if (this.totalApplications < rows.length) {
			rows.slice(this.totalApplications).forEach(async row => await this.createTicket(row));
		}
	}
	
	async createTicket(row) {
		let ticketChannel = this.createChannel(row);
	}
	
	async createChannel(row) {
		let tag = row["What is your Discord Tag?"].split("#");
		let username = tag[0];
		let discriminator = tag[1];
		let user;
		
		// Converts discord tag into User object
		this.guild.members.cache.forEach(member => {
			if ((member.nickname == username || member.user.username == username) && member.user.discriminator == discriminator) {
				user = member;
				return;
			}
		});
		
		// Creates the ticket 
		let permissions = user? [{ id: user, allow: "VIEW_CHANNEL" }]: [];
		let channel = this.guild.channels.create(`${username}-ticket`, { 
			parent: this.client.moduleConfig["Application System"]["category-id"],
			permissionOverwrites: permissions
		});
		
		await this.client.db.async_run("UPDATE settings SET value = value + 1 WHERE key = \"total_applications\"");
		return channel;
	}
}

module.exports = Form;