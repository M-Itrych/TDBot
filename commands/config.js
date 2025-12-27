const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Ścieżka do pliku konfiguracji
const configPath = path.join(__dirname, '..', 'config.json');

// Wczytaj lub utwórz konfigurację
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

// Zapisz konfigurację
const saveConfig = (config) => {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('[ERROR] Błąd zapisywania konfiguracji:', error);
        return false;
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Konfiguracja kanałów dla raportów, kar i kontroli (tylko dla administracji)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('raport')
                .setDescription('Ustaw kanał Forum dla raportów (prywatne wątki)')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Kanał Forum dla raportów')
                        .addChannelTypes(ChannelType.GuildForum)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('kary')
                .setDescription('Ustaw kanał dla kar')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Kanał tekstowy dla kar')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('kontrole')
                .setDescription('Ustaw kanał dla kontroli')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Kanał tekstowy dla kontroli')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('admin_rola')
                .setDescription('Ustaw rolę administratorów do zatwierdzania kar')
                .addRoleOption(option =>
                    option.setName('rola')
                        .setDescription('Rola administratorów')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('funkcjonariusz_rola')
                .setDescription('Ustaw rolę funkcjonariuszy (dostęp do komend)')
                .addRoleOption(option =>
                    option.setName('rola')
                        .setDescription('Rola funkcjonariuszy')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('podania')
                .setDescription('Ustaw kanał dla podań do TD')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Kanał tekstowy dla podań')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('wyniki_podan')
                .setDescription('Ustaw kanał dla wyników podań')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Kanał tekstowy dla wyników podań')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('podania_role')
                .setDescription('Ustaw role nadawane przy akceptacji podania')
                .addRoleOption(option =>
                    option.setName('rola1')
                        .setDescription('Pierwsza rola do nadania')
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option.setName('rola2')
                        .setDescription('Druga rola do nadania (opcjonalna)')
                        .setRequired(false)
                )
                .addRoleOption(option =>
                    option.setName('rola3')
                        .setDescription('Trzecia rola do nadania (opcjonalna)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('pokaz')
                .setDescription('Pokaż aktualną konfigurację')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        let config = loadConfig();

        // Inicjalizacja konfiguracji dla serwera
        if (!config[guildId]) {
            config[guildId] = {};
        }

        if (subcommand === 'pokaz') {
            // Pokaż aktualną konfigurację
            const guildConfig = config[guildId] || {};

            const embed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setTitle('⚙️ Konfiguracja Bota')
                .setDescription('Aktualne ustawienia kanałów i ról')
                .addFields(
                    {
                        name: '📋 Raporty',
                        value: guildConfig.raportChannel ? `<#${guildConfig.raportChannel}>` : '❌ Nie ustawiono',
                        inline: true
                    },
                    {
                        name: '⚖️ Kary',
                        value: guildConfig.karyChannel ? `<#${guildConfig.karyChannel}>` : '❌ Nie ustawiono',
                        inline: true
                    },
                    {
                        name: '🔍 Kontrole',
                        value: guildConfig.kontroleChannel ? `<#${guildConfig.kontroleChannel}>` : '❌ Nie ustawiono',
                        inline: true
                    },
                    {
                        name: '👮 Rola Admin',
                        value: guildConfig.adminRole ? `<@&${guildConfig.adminRole}>` : '❌ Nie ustawiono',
                        inline: true
                    },
                    {
                        name: '🎖️ Rola Funkcjonariusz',
                        value: guildConfig.funkcjonariuszRole ? `<@&${guildConfig.funkcjonariuszRole}>` : '❌ Nie ustawiono',
                        inline: true
                    },
                    {
                        name: '📝 Podania',
                        value: guildConfig.podaniaChannel ? `<#${guildConfig.podaniaChannel}>` : '❌ Nie ustawiono',
                        inline: true
                    },
                    {
                        name: '🏷️ Role przy akceptacji',
                        value: guildConfig.podaniaRoles && guildConfig.podaniaRoles.length > 0
                            ? guildConfig.podaniaRoles.map(r => `<@&${r}>`).join(', ')
                            : '❌ Nie ustawiono',
                        inline: true
                    },
                    {
                        name: '🏆 Wyniki podań',
                        value: guildConfig.wynikiPodanChannel ? `<#${guildConfig.wynikiPodanChannel}>` : '❌ Nie ustawiono',
                        inline: true
                    }
                )
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Ustaw rolę admina
        if (subcommand === 'admin_rola') {
            const role = interaction.options.getRole('rola');
            config[guildId].adminRole = role.id;

            if (saveConfig(config)) {
                const embed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('✅ Konfiguracja Zapisana')
                    .setDescription(`Rola administratorów została ustawiona na ${role}`)
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                return interaction.reply({
                    content: '❌ Wystąpił błąd podczas zapisywania konfiguracji!',
                    ephemeral: true
                });
            }
        }

        // Ustaw rolę funkcjonariuszy
        if (subcommand === 'funkcjonariusz_rola') {
            const role = interaction.options.getRole('rola');
            config[guildId].funkcjonariuszRole = role.id;

            if (saveConfig(config)) {
                const embed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('✅ Konfiguracja Zapisana')
                    .setDescription(`Rola funkcjonariuszy została ustawiona na ${role}\n\nOsoby z tą rolą mogą używać komend: /raport, /kontrola, /wystaw_kare`)
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                return interaction.reply({
                    content: '❌ Wystąpił błąd podczas zapisywania konfiguracji!',
                    ephemeral: true
                });
            }
        }

        // Ustaw role dla podań
        if (subcommand === 'podania_role') {
            const rola1 = interaction.options.getRole('rola1');
            const rola2 = interaction.options.getRole('rola2');
            const rola3 = interaction.options.getRole('rola3');

            const roles = [rola1.id];
            if (rola2) roles.push(rola2.id);
            if (rola3) roles.push(rola3.id);

            config[guildId].podaniaRoles = roles;

            if (saveConfig(config)) {
                const rolesList = roles.map(r => `<@&${r}>`).join(', ');
                const embed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('✅ Konfiguracja Zapisana')
                    .setDescription(`Role nadawane przy akceptacji podania:\n${rolesList}`)
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                return interaction.reply({
                    content: '❌ Wystąpił błąd podczas zapisywania konfiguracji!',
                    ephemeral: true
                });
            }
        }

        // Ustaw kanał dla wybranego typu
        const channel = interaction.options.getChannel('kanal');

        const channelTypes = {
            'raport': 'raportChannel',
            'kary': 'karyChannel',
            'kontrole': 'kontroleChannel',
            'podania': 'podaniaChannel',
            'wyniki_podan': 'wynikiPodanChannel'
        };

        const channelNames = {
            'raport': '📋 Raporty',
            'kary': '⚖️ Kary',
            'kontrole': '🔍 Kontrole',
            'podania': '📝 Podania',
            'wyniki_podan': '🏆 Wyniki podań'
        };

        config[guildId][channelTypes[subcommand]] = channel.id;

        if (saveConfig(config)) {
            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ Konfiguracja Zapisana')
                .setDescription(`Kanał dla **${channelNames[subcommand]}** został ustawiony na ${channel}`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else {
            await interaction.reply({
                content: '❌ Wystąpił błąd podczas zapisywania konfiguracji!',
                ephemeral: true
            });
        }
    },

    // Eksportuj funkcje pomocnicze do użycia w innych komendach
    loadConfig,
    saveConfig,
};
