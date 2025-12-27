const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Ścieżki do plików
const configPath = path.join(__dirname, '..', 'config.json');

// Wczytaj konfigurację
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
        .setName('raport')
        .setDescription('Utwórz nowy raport (dodany do Twojego Dziennika Pracy)')
        .addAttachmentOption(option =>
            option.setName('zdjecie')
                .setDescription('Załącz zdjęcie/dowód (WYMAGANE)')
                .setRequired(true)
        ),

    async execute(interaction) {
        const guildId = interaction.guild.id;

        // Wczytaj konfigurację
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

        // Sprawdź czy kanał jest skonfigurowany
        if (!guildConfig.raportChannel) {
            return interaction.reply({
                content: '❌ **Kanał Forum dla raportów nie został skonfigurowany!**\nAdministrator musi użyć `/config raport` aby ustawić kanał Forum.',
                ephemeral: true
            });
        }

        const raportChannel = interaction.guild.channels.cache.get(guildConfig.raportChannel);
        if (!raportChannel) {
            return interaction.reply({
                content: '❌ **Nie znaleziono skonfigurowanego kanału Forum!**',
                ephemeral: true
            });
        }

        // Sprawdź czy to kanał Forum
        if (raportChannel.type !== 15) {
            return interaction.reply({
                content: '❌ **Skonfigurowany kanał nie jest kanałem Forum!**',
                ephemeral: true
            });
        }

        // Pobierz załącznik (WYMAGANE)
        const zdjecie = interaction.options.getAttachment('zdjecie');

        // Zapisz załącznik w cache do późniejszego użycia
        interaction.client.tempAttachments.set(interaction.user.id, {
            url: zdjecie.url,
            name: zdjecie.name,
            contentType: zdjecie.contentType
        });

        // Stwórz modal
        const modal = new ModalBuilder()
            .setCustomId('raport_modal')
            .setTitle('📋 Nowy Raport');

        const trescInput = new TextInputBuilder()
            .setCustomId('co')
            .setLabel('Treść raportu')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('Opisz szczegółowo sytuację...')
            .setMaxLength(2000);

        const tytulInput = new TextInputBuilder()
            .setCustomId('tytul')
            .setLabel('Tytuł raportu (opcjonalne)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('np. Interwencja, Patrol, etc.')
            .setMaxLength(100);

        const osobyInput = new TextInputBuilder()
            .setCustomId('osoby')
            .setLabel('Osoby zaangażowane (opcjonalne)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('Wymień osoby zaangażowane...')
            .setMaxLength(500);

        const row1 = new ActionRowBuilder().addComponents(trescInput);
        const row2 = new ActionRowBuilder().addComponents(tytulInput);
        const row3 = new ActionRowBuilder().addComponents(osobyInput);

        modal.addComponents(row1, row2, row3);

        // Pokaż modal
        await interaction.showModal(modal);
    },
};
