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
        .setName('zloz_podanie')
        .setDescription('Złóż podanie o przyjęcie do AIAD'),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const config = loadConfig();
        const guildConfig = config[guildId] || {};

        // Sprawdź czy kanał podań jest skonfigurowany
        if (!guildConfig.podaniaChannel) {
            return interaction.reply({
                content: '❌ **Kanał dla podań nie został skonfigurowany!**\nAdministrator musi użyć `/config podania` aby ustawić kanał.',
                ephemeral: true
            });
        }

        // Tworzenie modala
        const modal = new ModalBuilder()
            .setCustomId('zloz_podanie_modal')
            .setTitle('📝 Podanie do TD');

        // Pole 1: Dane podstawowe (połączone)
        const daneInput = new TextInputBuilder()
            .setCustomId('dane')
            .setLabel('Imię IC, UID, Wiek OOC')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('np. Jan Kowalski, 12345, 21 lat')
            .setRequired(true)
            .setMaxLength(150);

        // Pole 2: Ranga w LSCSD
        const rangaInput = new TextInputBuilder()
            .setCustomId('ranga')
            .setLabel('Którą posiadasz aktualnie rangę w LSCSD?')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('np. Deputy, Corporal, Sergeant...')
            .setRequired(true)
            .setMaxLength(100);

        // Pole 3: Czym jest AIAD
        const czymInput = new TextInputBuilder()
            .setCustomId('czym_aiad')
            .setLabel('Czym jest TD?')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Opisz czym według Ciebie jest TD...')
            .setRequired(true)
            .setMaxLength(500);

        // Pole 4: Główne zadania
        const zadaniaInput = new TextInputBuilder()
            .setCustomId('zadania')
            .setLabel('Co należy do głównych zadań TD?')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Wymień główne zadania TD...')
            .setRequired(true)
            .setMaxLength(500);

        // Pole 5: Dlaczego chce dołączyć
        const dlaczegoInput = new TextInputBuilder()
            .setCustomId('dlaczego')
            .setLabel('Dlaczego chcesz dołączyć do TD?')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Opisz swoją motywację...')
            .setRequired(true)
            .setMaxLength(500);

        // Dodanie pól do modala
        modal.addComponents(
            new ActionRowBuilder().addComponents(daneInput),
            new ActionRowBuilder().addComponents(rangaInput),
            new ActionRowBuilder().addComponents(czymInput),
            new ActionRowBuilder().addComponents(zadaniaInput),
            new ActionRowBuilder().addComponents(dlaczegoInput)
        );

        await interaction.showModal(modal);
    },
};
