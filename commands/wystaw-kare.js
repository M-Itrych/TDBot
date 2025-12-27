const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const configPath = path.join(__dirname, '..', 'config.json');

const loadConfig = () => {
    try {
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch (error) {
        console.error('[ERROR] Błąd wczytywania konfiguracji:', error);
    }
    return {};
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wystaw_kare')
        .setDescription('Wystaw karę funkcjonariuszowi')
        .addAttachmentOption(option =>
            option.setName('dowod')
                .setDescription('Dowód (zdjęcie/plik)')
                .setRequired(true)
        ),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const config = loadConfig();
        const guildConfig = config[guildId] || {};

        // Sprawdź czy użytkownik ma rolę funkcjonariusza
        if (guildConfig.funkcjonariuszRole) {
            const member = interaction.member;
            const hasFunkcjonariuszRole = member.roles.cache.has(guildConfig.funkcjonariuszRole);
            const hasAdminRole = guildConfig.adminRole && member.roles.cache.has(guildConfig.adminRole);
            const isAdmin = member.permissions.has('Administrator');

            if (!hasFunkcjonariuszRole && !hasAdminRole && !isAdmin) {
                return interaction.reply({
                    content: '❌ **Brak uprawnień!** Tylko funkcjonariusze mogą używać tej komendy.',
                    ephemeral: true
                });
            }
        }

        // Pobierz dowód przed pokazaniem modala
        const dowod = interaction.options.getAttachment('dowod');

        // Zapisz w cache
        if (!interaction.client.tempKaraData) {
            interaction.client.tempKaraData = new Map();
        }
        interaction.client.tempKaraData.set(interaction.user.id, { dowod });

        // Tworzenie modala
        const modal = new ModalBuilder()
            .setCustomId('wystaw_kare_modal')
            .setTitle('⚖️ Wystawienie Kary');

        // Pole: Tier
        const tierInput = new TextInputBuilder()
            .setCustomId('tier')
            .setLabel('Tier kary')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Upomnienie / 1 / 2 / 3 / 4 / 5')
            .setRequired(true)
            .setMaxLength(20);

        // Pole: Funkcjonariusz
        const funkcjonariuszInput = new TextInputBuilder()
            .setCustomId('funkcjonariusz')
            .setLabel('Funkcjonariusz popełniający przewinienie')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Imię i nazwisko / pseudonim / ID')
            .setRequired(true)
            .setMaxLength(100);

        // Pole: Paragraf
        const paragrafInput = new TextInputBuilder()
            .setCustomId('paragraf')
            .setLabel('Paragraf z Taryfikatora')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('np. §5.1, §12.3')
            .setRequired(true)
            .setMaxLength(50);

        // Pole: Opis przewinienia
        const opisInput = new TextInputBuilder()
            .setCustomId('opis')
            .setLabel('Opis przewinienia')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Opisz szczegółowo co się stało...')
            .setRequired(true)
            .setMaxLength(1000);

        // Pole: Okoliczności łagodzące/obciążające
        const okolicznosciInput = new TextInputBuilder()
            .setCustomId('okolicznosci')
            .setLabel('Okoliczności (opcjonalne)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Łagodzące lub obciążające')
            .setRequired(false)
            .setMaxLength(200);

        // Dodanie pól do modala (max 5 pól w modalu)
        modal.addComponents(
            new ActionRowBuilder().addComponents(tierInput),
            new ActionRowBuilder().addComponents(funkcjonariuszInput),
            new ActionRowBuilder().addComponents(paragrafInput),
            new ActionRowBuilder().addComponents(opisInput),
            new ActionRowBuilder().addComponents(okolicznosciInput)
        );

        await interaction.showModal(modal);
    },
};
