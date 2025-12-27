const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
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
        .setName('kontrola')
        .setDescription('Zarejestruj kontrolę (widoczne tylko dla administracji)'),

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

        // Tworzenie modala
        const modal = new ModalBuilder()
            .setCustomId('kontrola_modal')
            .setTitle('📋 Rejestracja Kontroli');

        // Pole: Kto przeprowadza kontrolę
        const ktoInput = new TextInputBuilder()
            .setCustomId('kto')
            .setLabel('Kto przeprowadza kontrolę?')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Imię i nazwisko / pseudonim')
            .setRequired(true)
            .setMaxLength(100);

        // Pole: Kogo dotyczy kontrola
        const komuInput = new TextInputBuilder()
            .setCustomId('komu')
            .setLabel('Kogo dotyczy kontrola?')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Imię i nazwisko / pseudonim kontrolowanego')
            .setRequired(true)
            .setMaxLength(100);

        // Pole: Data/czas kontroli
        const kiedyInput = new TextInputBuilder()
            .setCustomId('kiedy')
            .setLabel('Data i czas kontroli')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('np. 25.12.2024 14:30')
            .setRequired(true)
            .setMaxLength(50);

        // Pole: Uwagi (opcjonalne)
        const uwagiInput = new TextInputBuilder()
            .setCustomId('uwagi')
            .setLabel('Dodatkowe uwagi (opcjonalne)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Wpisz dodatkowe informacje o kontroli...')
            .setRequired(false)
            .setMaxLength(500);

        // Dodanie pól do modala (każdy w osobnym ActionRow)
        modal.addComponents(
            new ActionRowBuilder().addComponents(ktoInput),
            new ActionRowBuilder().addComponents(komuInput),
            new ActionRowBuilder().addComponents(kiedyInput),
            new ActionRowBuilder().addComponents(uwagiInput)
        );

        await interaction.showModal(modal);
    },
};
