import {
	Channel,
	Collection,
	EmbedField,
	EmbedFieldData,
	Message,
	MessageEmbed,
	SnowflakeUtil,
	TextChannel
} from "discord.js";
import { config, instance } from "../index";
import { Database, Schemas } from "../database";
import { Colors } from "../utils/theme";

export interface Archivable {
	archive(status: any): Promise<void>;
	vote(context: any): Promise<Channel>;
}

export module Archive {
	export async function getMessageHistory(channel: TextChannel): Promise<Message[]> {
		const BATCH_SIZE = 50;
		let history: Message[] = [];
		let batch: Collection<string, Message>;
		let lastMessageID = channel.lastMessageID;

		// Fetches batches of messages in a channel, until
		// it reaches the first message posted in it.
		do {
			batch = await channel.messages.fetch({
				limit: BATCH_SIZE,
				before: lastMessageID || SnowflakeUtil.generate(Date.now())
			}, false);

			if (batch.size == 0) break;
			lastMessageID = batch.last()!.id;

			history = [ ...batch.array(), ...history ];
		} while (batch.size == BATCH_SIZE);

		return history.reverse();
	}
}

export class Ticket
	implements Archivable {

	private constructor(public channel: TextChannel,
						public data: Schemas.TicketAttributes & Partial<Schemas.ApplicantAttributes>) {
	}

	static async generate(answers: { [k: string]: string }): Promise<Ticket> {
		if (!config.application_system) throw new Error();

		const guild = await instance.guilds.resolve(config.application_system.guild_id)!;

		const tag = answers["What is your Discord Tag?"];
		const [, username, discriminator ] = /(.+)#([0-9]{4})/g.exec(tag) ?? [];

		// Fetches the user on the guild
		const members = await guild.members.fetch();
		const member = members.find(member =>
			member.user.tag.toLowerCase() == tag.toLocaleLowerCase());

		// Creates the channel
		const channel: TextChannel = await guild.channels.create(
			`${username}-ticket`,
			{ parent: config.application_system.category_id }
		);
		if (member)
			await channel.createOverwrite(member, { VIEW_CHANNEL: true });
		else {
			const embed = new MessageEmbed()
				.setColor(Colors.ERROR)
				.setDescription(`Couldn't find user ${tag}`);
			await channel.send(embed);
		}

		// Generates the embed (i hate this code)
		const fields: EmbedFieldData[] = [];
		for (const [ question, answer ]
			of Object.entries(answers)) {

			const maxLength = 1000;
			let hasAlreadyPutTitle = false;
			let bitWhichFits = "";
			let bitWhichDoesntFit = answer;
			do {
				bitWhichFits = bitWhichDoesntFit.slice(0, maxLength)
				bitWhichDoesntFit = bitWhichDoesntFit.slice(maxLength);
				fields.push({
					name: !hasAlreadyPutTitle ?
						(hasAlreadyPutTitle = true, question) :
						"\u200B",
					value: bitWhichFits
				});
			} while (bitWhichDoesntFit != "");
		}

		let embed: MessageEmbed | null = new MessageEmbed()
			.setColor(Colors.TRANSPARENT)
			.setAuthor("ENDTECH APPLICATION");
		let currentEmbedCharacterLength = 0;
		for (const field of fields) {
			if (embed == null) {
				embed = new MessageEmbed()
					.setColor(Colors.TRANSPARENT);
			}

			embed.fields.push(field as EmbedField);
			currentEmbedCharacterLength += field.value.length;

			if (currentEmbedCharacterLength >= 5500 ||
				embed.fields.length >= 25) {
				await channel.send(embed);
				embed = null;
			}
		}
		if (embed != null) {
			await channel.send(embed);
		}

		const ticket = await Database.Tickets.create({
			channel_id: channel.id,
			applicant_id: member?.user.id || null,
			raw_messages: "[]"
		});

		const applicant_id = member?.user.id || null;

		const [ applicant ] = await Database.Applicants.findOrCreate({
			where: { applicant_id },
			defaults: {
				applicant_id,
				profile_picture: member?.user.displayAvatarURL() || "",
				name: username,
				discriminator
			}
		})

		return new Ticket(channel, { ...applicant.get(), ...ticket.get() });
	}

	static async from(channel: TextChannel): Promise<Ticket | null> {
		const ticket = await Database.Tickets.findOne({
			where: {
				channel_id: channel.id
			},
		});
		if (!ticket) return null;
		const applicant = await Database.Applicants.findOne({
			where: { applicant_id: ticket.get().applicant_id }
		});

		return new Ticket(channel, { ...ticket.get(), ...applicant?.get() });
	}

	async archive(status: TicketStatus): Promise<void> {
		const history = await Archive.getMessageHistory(this.channel);
		const encoded = JSON.stringify(history.map(message => message.toJSON()));
		const entry = await Database.Tickets.update(
			{ raw_messages: encoded, status },
			{ where: { channel_id: this.channel.id } }
		);
	}

	async vote(): Promise<Channel> {
		const channel = await instance.channels.fetch(config.application_system!.voting_channel) as TextChannel;
		if (!channel) throw "invalid voting channel";

		const embed = new MessageEmbed()
			.setColor(Colors.ENDTECH)
			.setAuthor(this.data.name || "unknown name",
				this.data.profile_picture)
			.setDescription(`<#${this.data.channel_id}>`);

		const message = await channel.send(embed);
		await message.react(config.application_system!.yes);
		await message.react(config.application_system!.no);

		return channel;
	}
}

export enum TicketStatus {
	PENDING,
	ACCEPTED,
	DECLINED,
	BRUH
}