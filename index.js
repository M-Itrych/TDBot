require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, Events, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Ścieżki do plików
const configPath = path.join(__dirname, 'config.json');
const countersPath = path.join(__dirname, 'counters.json');
const userThreadsPath = path.join(__dirname, 'user-threads.json');

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

// Wczytaj liczniki
const loadCounters = () => {
    try {
        if (fs.existsSync(countersPath)) {
            return JSON.parse(fs.readFileSync(countersPath, 'utf8'));
        }
    } catch (error) {
        console.error('[ERROR] Błąd wczytywania liczników:', error);
    }
    return {};
};

// Zapisz liczniki
const saveCounters = (counters) => {
    try {
        fs.writeFileSync(countersPath, JSON.stringify(counters, null, 2));
    } catch (error) {
        console.error('[ERROR] Błąd zapisywania liczników:', error);
    }
};

// Generuj numery
const generateNumber = (guildId, type) => {
    const counters = loadCounters();
    if (!counters[guildId]) {
        counters[guildId] = { raport: 0, kara: 0, kontrola: 0 };
    }
    counters[guildId][type]++;
    saveCounters(counters);

    const year = new Date().getFullYear();
    const paddedNumber = String(counters[guildId][type]).padStart(4, '0');

    const prefixes = { raport: 'TD', kara: 'KARA', kontrola: 'KONT' };
    return `${prefixes[type]}-${year}-${paddedNumber}`;
};

// Wczytaj mapowanie użytkownik -> wątek personalny
const loadUserThreads = () => {
    try {
        if (fs.existsSync(userThreadsPath)) {
            return JSON.parse(fs.readFileSync(userThreadsPath, 'utf8'));
        }
    } catch (error) {
        console.error('[ERROR] Błąd wczytywania wątków użytkowników:', error);
    }
    return {};
};

// Zapisz mapowanie użytkownik -> wątek personalny
const saveUserThreads = (threads) => {
    try {
        fs.writeFileSync(userThreadsPath, JSON.stringify(threads, null, 2));
    } catch (error) {
        console.error('[ERROR] Błąd zapisywania wątków użytkowników:', error);
    }
};

// Pobierz personalny wątek dla użytkownika
const getUserThread = (guildId, userId) => {
    const threads = loadUserThreads();
    if (!threads[guildId]) {
        threads[guildId] = {};
    }
    return threads[guildId][userId] || null;
};

// Zapisz personalny wątek użytkownika
const setUserThread = (guildId, userId, threadId) => {
    const threads = loadUserThreads();
    if (!threads[guildId]) {
        threads[guildId] = {};
    }
    threads[guildId][userId] = threadId;
    saveUserThreads(threads);
};

// Tworzenie klienta z wymaganymi intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ]
});

// Kolekcja komend
client.commands = new Collection();

// Tymczasowe przechowywanie załączników
client.tempAttachments = new Map();
client.tempKaraData = new Map();

// Ładowanie komend z folderu /commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`[INFO] Załadowano komendę: ${command.data.name}`);
    } else {
        console.log(`[WARN] Komenda w ${filePath} nie ma wymaganych właściwości "data" lub "execute".`);
    }
}

// Event: Bot gotowy
client.once(Events.ClientReady, (readyClient) => {
    console.log(`[OK] Bot zalogowany jako ${readyClient.user.tag}`);
    console.log(`[OK] Obsługuję ${readyClient.guilds.cache.size} serwerów`);
});

// Event: Obsługa interakcji
client.on(Events.InteractionCreate, async (interaction) => {
    // Obsługa komend slash
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`[ERROR] Nie znaleziono komendy: ${interaction.commandName}`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`[ERROR] Błąd podczas wykonywania komendy ${interaction.commandName}:`, error);

            const errorMessage = {
                content: '❌ Wystąpił błąd podczas wykonywania komendy!',
                ephemeral: true
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
        return;
    }

    // Obsługa przycisków
    if (interaction.isButton()) {
        const customId = interaction.customId;
        const guildId = interaction.guild.id;
        const config = loadConfig();
        const guildConfig = config[guildId] || {};

        // Sprawdź czy użytkownik ma rolę admina
        const member = interaction.member;
        const hasAdminRole = guildConfig.adminRole && member.roles.cache.has(guildConfig.adminRole);

        if (!hasAdminRole) {
            return interaction.reply({
                content: '❌ **Brak uprawnień!** Tylko osoby z rolą administratora mogą wykonać tę akcję.',
                ephemeral: true
            });
        }

        const originalEmbed = interaction.message.embeds[0];

        // ===== PRZYCISKI PODAŃ =====
        if (customId.startsWith('podanie_')) {
            const parts = customId.split('_');
            const action = parts[1]; // accept, reject
            const odeslany = parts[2]; // odeslany - przekierowanie do userId
            const applicantId = parts.slice(3).join('_'); // ID użytkownika

            if (action === 'accept') {
                try {
                    // Pobierz członka serwera
                    const applicant = await interaction.guild.members.fetch(applicantId);

                    // Nadaj role
                    const rolesToAdd = guildConfig.podaniaRoles || [];
                    for (const roleId of rolesToAdd) {
                        try {
                            await applicant.roles.add(roleId);
                        } catch (roleError) {
                            console.error(`[ERROR] Nie można nadać roli ${roleId}:`, roleError);
                        }
                    }

                    // Wyślij DM
                    try {
                        await applicant.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(0x2ecc71)
                                    .setTitle('🎉 Gratulacje! Twoje podanie zostało zaakceptowane!')
                                    .setDescription('Witamy w TD! Twoje podanie do wydziału zostało pozytywnie rozpatrzone.\n\nRole zostały automatycznie nadane.')
                                    .setFooter({ text: `Zaakceptowane przez: ${interaction.user.tag}` })
                                    .setTimestamp()
                            ]
                        });
                    } catch (dmError) {
                        console.log(`[WARN] Nie można wysłać DM do ${applicant.user.tag}`);
                    }

                    // Aktualizuj embed
                    const updatedEmbed = EmbedBuilder.from(originalEmbed)
                        .setColor(0x2ecc71)
                        .setDescription(`✅ **Status:** Zaakceptowane przez <@${interaction.user.id}>`)
                        .setFooter({ text: `Zaakceptowane: ${new Date().toLocaleString('pl-PL')}` });

                    await interaction.update({
                        embeds: [updatedEmbed],
                        components: []
                    });

                    console.log(`[INFO] Podanie użytkownika ${applicant.user.tag} zaakceptowane przez ${interaction.user.tag}`);

                } catch (error) {
                    console.error('[ERROR] Błąd akceptacji podania:', error);
                    await interaction.reply({
                        content: '❌ Wystąpił błąd podczas akceptacji podania.',
                        ephemeral: true
                    });
                }
            }

            else if (action === 'reject') {
                try {
                    // Pobierz członka
                    const applicant = await interaction.guild.members.fetch(applicantId);

                    // Wyślij DM o odrzuceniu
                    try {
                        await applicant.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(0xe74c3c)
                                    .setTitle('❌ Twoje podanie zostało odrzucone')
                                    .setDescription('Niestety, Twoje podanie do TD nie zostało przyjęte.\n\nMożesz spróbować ponownie w przyszłości.')
                                    .setFooter({ text: `Odrzucone przez: ${interaction.user.tag}` })
                                    .setTimestamp()
                            ]
                        });
                    } catch (dmError) {
                        console.log(`[WARN] Nie można wysłać DM do ${applicant.user.tag}`);
                    }

                    // Aktualizuj embed
                    const updatedEmbed = EmbedBuilder.from(originalEmbed)
                        .setColor(0xe74c3c)
                        .setDescription(`❌ **Status:** Odrzucone przez <@${interaction.user.id}>`)
                        .setFooter({ text: `Odrzucone: ${new Date().toLocaleString('pl-PL')}` });

                    await interaction.update({
                        embeds: [updatedEmbed],
                        components: []
                    });

                    console.log(`[INFO] Podanie użytkownika ${applicant.user.tag} odrzucone przez ${interaction.user.tag}`);

                } catch (error) {
                    console.error('[ERROR] Błąd odrzucenia podania:', error);
                    await interaction.reply({
                        content: '❌ Wystąpił błąd podczas odrzucenia podania.',
                        ephemeral: true
                    });
                }
            }

            return;
        }

        // ===== PRZYCISKI KAR =====
        if (customId.startsWith('kara_')) {
            const parts = customId.split('_');
            const action = parts[1]; // accept, reject, modify
            const karaNumber = parts.slice(2).join('_'); // KARA-2024-0001

            if (action === 'accept') {
                const updatedEmbed = EmbedBuilder.from(originalEmbed)
                    .setColor(0x2ecc71)
                    .setDescription(`✅ **Status:** Zaakceptowana przez <@${interaction.user.id}>`)
                    .setFooter({ text: `Zaakceptowana: ${new Date().toLocaleString('pl-PL')}` });

                await interaction.update({
                    embeds: [updatedEmbed],
                    components: []
                });

                console.log(`[INFO] Kara ${karaNumber} zaakceptowana przez ${interaction.user.tag}`);
            }

            else if (action === 'reject') {
                const updatedEmbed = EmbedBuilder.from(originalEmbed)
                    .setColor(0x95a5a6)
                    .setDescription(`❌ **Status:** Odrzucona przez <@${interaction.user.id}>`)
                    .setFooter({ text: `Odrzucona: ${new Date().toLocaleString('pl-PL')}` });

                await interaction.update({
                    embeds: [updatedEmbed],
                    components: []
                });

                console.log(`[INFO] Kara ${karaNumber} odrzucona przez ${interaction.user.tag}`);
            }

            else if (action === 'modify') {
                const modal = new ModalBuilder()
                    .setCustomId(`kara_modify_modal_${karaNumber}`)
                    .setTitle(`Zmiana kary ${karaNumber}`);

                const newTierInput = new TextInputBuilder()
                    .setCustomId('new_tier')
                    .setLabel('Nowy Tier (np. Tier 1, Tier 2, etc.)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder('Tier 1');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('reason')
                    .setLabel('Powód zmiany')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setPlaceholder('Wpisz powód zmiany kary...');

                const row1 = new ActionRowBuilder().addComponents(newTierInput);
                const row2 = new ActionRowBuilder().addComponents(reasonInput);

                modal.addComponents(row1, row2);

                await interaction.showModal(modal);
            }

            return;
        }

        return;
    }

    // Obsługa modali
    if (interaction.isModalSubmit()) {
        const customId = interaction.customId;
        const guildId = interaction.guild.id;
        const config = loadConfig();
        const guildConfig = config[guildId] || {};

        // ===== MODAL: KONTROLA =====
        if (customId === 'kontrola_modal') {
            const kto = interaction.fields.getTextInputValue('kto');
            const komu = interaction.fields.getTextInputValue('komu');
            const kiedy = interaction.fields.getTextInputValue('kiedy');
            const uwagi = interaction.fields.getTextInputValue('uwagi') || null;
            const creatorId = interaction.user.id;

            // Sprawdź konfigurację
            if (!guildConfig.kontroleChannel) {
                return interaction.reply({
                    content: '❌ **Kanał dla kontroli nie został skonfigurowany!**\nAdministrator musi użyć `/config kontrole` aby ustawić kanał.',
                    ephemeral: true
                });
            }

            const kontroleChannel = interaction.guild.channels.cache.get(guildConfig.kontroleChannel);
            if (!kontroleChannel) {
                return interaction.reply({
                    content: '❌ **Nie znaleziono skonfigurowanego kanału!**',
                    ephemeral: true
                });
            }

            const kontrolaNumber = generateNumber(guildId, 'kontrola');

            // Tworzenie embed
            const embed = new EmbedBuilder()
                .setColor(0x1abc9c)
                .setTitle(`🔍 Kontrola ${kontrolaNumber}`)
                .setDescription('Nowa kontrola została zarejestrowana')
                .addFields(
                    { name: '📝 Nr. Kontroli', value: kontrolaNumber, inline: true },
                    { name: '📅 Zarejestrowano', value: new Date().toLocaleString('pl-PL'), inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '👮 Kontrolujący', value: kto, inline: true },
                    { name: '🎯 Kontrolowany', value: komu, inline: true },
                    { name: '🕐 Termin', value: kiedy, inline: true }
                )
                .setFooter({ text: `Zarejestrowane przez: ${interaction.user.tag}` })
                .setTimestamp();

            if (uwagi) {
                embed.addFields({ name: '📌 Uwagi', value: uwagi, inline: false });
            }

            try {
                const message = await kontroleChannel.send({ embeds: [embed] });

                const thread = await message.startThread({
                    name: `Kontrola ${kontrolaNumber} - ${komu}`,
                    autoArchiveDuration: 1440,
                    reason: `Kontrola zarejestrowana przez ${interaction.user.tag}`
                });

                await thread.send({
                    content: `🔍 **Kontrola ${kontrolaNumber}** zarejestrowana przez <@${creatorId}>\n\n**Kontrolujący:** ${kto}\n**Kontrolowany:** ${komu}\n**Termin:** ${kiedy}${uwagi ? `\n**Uwagi:** ${uwagi}` : ''}\n\nTen wątek służy do dokumentacji kontroli.`
                });

                await interaction.reply({
                    content: `✅ **Kontrola ${kontrolaNumber} została zarejestrowana!**\n\n📍 Thread: ${thread}\n📋 Kanał: ${kontroleChannel}`,
                    ephemeral: true
                });

            } catch (error) {
                console.error('[ERROR] Błąd rejestrowania kontroli:', error);
                await interaction.reply({
                    content: '❌ Wystąpił błąd podczas rejestrowania kontroli.',
                    ephemeral: true
                });
            }
            return;
        }

        // ===== MODAL: ZŁÓŻ PODANIE =====
        if (customId === 'zloz_podanie_modal') {
            const dane = interaction.fields.getTextInputValue('dane');
            const ranga = interaction.fields.getTextInputValue('ranga');
            const czymAiad = interaction.fields.getTextInputValue('czym_aiad');
            const zadania = interaction.fields.getTextInputValue('zadania');
            const dlaczego = interaction.fields.getTextInputValue('dlaczego');
            const creatorId = interaction.user.id;

            // Sprawdź konfigurację
            if (!guildConfig.podaniaChannel) {
                return interaction.reply({
                    content: '❌ **Kanał dla podań nie został skonfigurowany!**\nAdministrator musi użyć `/config podania` aby ustawić kanał.',
                    ephemeral: true
                });
            }

            const podaniaChannel = interaction.guild.channels.cache.get(guildConfig.podaniaChannel);
            if (!podaniaChannel) {
                return interaction.reply({
                    content: '❌ **Nie znaleziono skonfigurowanego kanału!**',
                    ephemeral: true
                });
            }

            // Tworzenie embed
            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('📝 Nowe Podanie do TD')
                .setDescription('🕐 **Status:** Oczekuje na rozpatrzenie')
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '👤 Składający', value: `<@${creatorId}>`, inline: true },
                    { name: '📅 Data złożenia', value: new Date().toLocaleString('pl-PL'), inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '📋 Dane (Imię IC, UID, Wiek)', value: dane, inline: false },
                    { name: '🎖️ Aktualna ranga w LSCSD', value: ranga, inline: false },
                    { name: '❓ Czym jest TD?', value: czymAiad, inline: false },
                    { name: '📌 Główne zadania TD', value: zadania, inline: false },
                    { name: '💭 Dlaczego chce dołączyć', value: dlaczego, inline: false }
                )
                .setFooter({ text: `ID użytkownika: ${creatorId}` })
                .setTimestamp();

            // Przyciski akcji
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`podanie_accept_user_${creatorId}`)
                        .setLabel('✅ Zaakceptuj')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`podanie_reject_user_${creatorId}`)
                        .setLabel('❌ Odrzuć')
                        .setStyle(ButtonStyle.Danger)
                );

            try {
                await podaniaChannel.send({
                    content: guildConfig.adminRole ? `<@&${guildConfig.adminRole}> - Nowe podanie do rozpatrzenia` : '📝 Nowe podanie do rozpatrzenia',
                    embeds: [embed],
                    components: [actionRow]
                });

                await interaction.reply({
                    content: `✅ **Twoje podanie zostało złożone!**\n\n⏳ Oczekuj na decyzję administracji - otrzymasz powiadomienie na priv.`,
                    ephemeral: true
                });

                console.log(`[INFO] Podanie złożone przez ${interaction.user.tag}`);

            } catch (error) {
                console.error('[ERROR] Błąd składania podania:', error);
                await interaction.reply({
                    content: '❌ Wystąpił błąd podczas składania podania.',
                    ephemeral: true
                });
            }
            return;
        }

        // ===== MODAL: RAPORT =====
        if (customId.startsWith('raport_modal')) {
            const co = interaction.fields.getTextInputValue('co');
            const tytul = interaction.fields.getTextInputValue('tytul') || null;
            const osoby = interaction.fields.getTextInputValue('osoby') || null;
            const creatorId = interaction.user.id;

            // Pobierz załącznik z cache (został zapisany przed pokazaniem modala)
            const zdjecie = client.tempAttachments.get(interaction.user.id) || null;
            client.tempAttachments.delete(interaction.user.id);

            // Sprawdź konfigurację
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
            if (raportChannel.type !== 15) { // 15 = GuildForum
                return interaction.reply({
                    content: '❌ **Skonfigurowany kanał nie jest kanałem Forum!**\nAdministrator musi użyć `/config raport` z kanałem typu Forum.',
                    ephemeral: true
                });
            }

            const reportNumber = generateNumber(guildId, 'raport');

            // Tworzenie embed raportu
            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(`📋 Raport ${reportNumber}${tytul ? ` - ${tytul}` : ''}`)
                .addFields(
                    { name: '📝 Nr. Raportu', value: reportNumber, inline: true },
                    { name: '📅 Data', value: new Date().toLocaleString('pl-PL'), inline: true },
                    { name: '📄 Treść', value: co }
                )
                .setFooter({ text: `Raport #${reportNumber}` })
                .setTimestamp();

            if (osoby) {
                embed.addFields({ name: '👥 Osoby zaangażowane', value: osoby, inline: false });
            }

            // Obsługa obrazów (załącznik z komendy slash)
            if (zdjecie) {
                if (zdjecie.contentType && zdjecie.contentType.startsWith('image/')) {
                    embed.setImage(zdjecie.url);
                }
                embed.addFields({ name: '📎 Załącznik', value: `[${zdjecie.name}](${zdjecie.url})` });
            }

            try {
                // Sprawdź czy użytkownik ma już personalny wątek
                const existingThreadId = getUserThread(guildId, creatorId);
                let userThread = null;
                let isNewThread = false;

                if (existingThreadId) {
                    // Spróbuj pobrać istniejący wątek
                    try {
                        userThread = await raportChannel.threads.fetch(existingThreadId);

                        // Jeśli wątek jest zarchiwizowany, odarchiwizuj go
                        if (userThread && userThread.archived) {
                            await userThread.setArchived(false);
                        }
                    } catch (fetchError) {
                        // Wątek nie istnieje lub został usunięty
                        console.log(`[INFO] Wątek ${existingThreadId} nie istnieje, tworzę nowy dla użytkownika ${creatorId}`);
                        userThread = null;
                    }
                }

                // Jeśli użytkownik nie ma wątku, utwórz nowy
                if (!userThread) {
                    isNewThread = true;
                    const member = await interaction.guild.members.fetch(creatorId);
                    const userName = member.displayName || interaction.user.username;

                    // Tworzenie personalnego wątku w Forum
                    userThread = await raportChannel.threads.create({
                        name: `📁 ${userName} - Dziennik Pracy`,
                        autoArchiveDuration: 10080, // 7 dni
                        message: {
                            content: `# 📁 Dziennik Pracy\n\n**Funkcjonariusz:** <@${creatorId}>\n**Utworzono:** ${new Date().toLocaleString('pl-PL')}\n\n---\n\nTen wątek zawiera wszystkie raporty i wpisy dotyczące Twojej pracy. Każdy nowy raport będzie dodawany tutaj automatycznie.`
                        },
                        reason: `Personalny dziennik pracy dla ${interaction.user.tag}`
                    });

                    // Zapisz nowy wątek
                    setUserThread(guildId, creatorId, userThread.id);
                }

                // Dodaj raport do wątku użytkownika
                await userThread.send({
                    content: `📋 **Nowy wpis:** ${reportNumber}`,
                    embeds: [embed]
                });

                const responseMessage = isNewThread
                    ? `✅ **Raport ${reportNumber} został utworzony!**\n\n📁 Utworzono Twój **Dziennik Pracy**: ${userThread}\n📋 Wszystkie Twoje przyszłe raporty będą dodawane do tego wątku.`
                    : `✅ **Raport ${reportNumber} został dodany do Twojego Dziennika Pracy!**\n\n📍 Wątek: ${userThread}`;

                await interaction.reply({
                    content: responseMessage,
                    ephemeral: true
                });

                console.log(`[INFO] Raport ${reportNumber} dodany do dziennika użytkownika ${interaction.user.tag}${isNewThread ? ' (nowy wątek)' : ''}`);

            } catch (error) {
                console.error('[ERROR] Błąd tworzenia raportu:', error);
                await interaction.reply({
                    content: '❌ Wystąpił błąd podczas tworzenia raportu. Sprawdź uprawnienia bota!',
                    ephemeral: true
                });
            }
            return;
        }

        // ===== MODAL: WYSTAW KARE =====
        if (customId === 'wystaw_kare_modal') {
            const tierInput = interaction.fields.getTextInputValue('tier').trim();
            const funkcjonariusz = interaction.fields.getTextInputValue('funkcjonariusz');
            const paragraf = interaction.fields.getTextInputValue('paragraf');
            const opis = interaction.fields.getTextInputValue('opis');
            const okolicznosci = interaction.fields.getTextInputValue('okolicznosci') || null;
            const creatorId = interaction.user.id;

            // Walidacja i normalizacja tieru
            const tierMap = {
                'upomnienie': 'Upomnienie',
                '1': 'Tier 1',
                '2': 'Tier 2',
                '3': 'Tier 3',
                '4': 'Tier 4',
                '5': 'Tier 5',
                'tier 1': 'Tier 1',
                'tier 2': 'Tier 2',
                'tier 3': 'Tier 3',
                'tier 4': 'Tier 4',
                'tier 5': 'Tier 5',
            };

            const tierWarna = tierMap[tierInput.toLowerCase()];

            if (!tierWarna) {
                return interaction.reply({
                    content: '❌ **Nieprawidłowy tier!**\n\nDozwolone wartości: `Upomnienie`, `1`, `2`, `3`, `4`, `5`',
                    ephemeral: true
                });
            }

            // Pobierz dane z cache
            const karaData = client.tempKaraData.get(interaction.user.id);
            client.tempKaraData.delete(interaction.user.id);

            if (!karaData) {
                return interaction.reply({
                    content: '❌ **Błąd!** Dane formularza wygasły. Spróbuj ponownie.',
                    ephemeral: true
                });
            }

            const { dowod } = karaData;

            // Sprawdź konfigurację
            if (!guildConfig.karyChannel) {
                return interaction.reply({
                    content: '❌ **Kanał dla kar nie został skonfigurowany!**\nAdministrator musi użyć `/config kary` aby ustawić kanał.',
                    ephemeral: true
                });
            }

            if (!guildConfig.adminRole) {
                return interaction.reply({
                    content: '❌ **Rola administratorów nie została skonfigurowana!**',
                    ephemeral: true
                });
            }

            const karyChannel = interaction.guild.channels.cache.get(guildConfig.karyChannel);
            if (!karyChannel) {
                return interaction.reply({
                    content: '❌ **Nie znaleziono skonfigurowanego kanału!**',
                    ephemeral: true
                });
            }

            const karaNumber = generateNumber(guildId, 'kara');

            // Mapowanie kolorów
            const tierColors = {
                'Upomnienie': 0x3498db,
                'Tier 1': 0xf1c40f,
                'Tier 2': 0xe67e22,
                'Tier 3': 0xe74c3c,
                'Tier 4': 0x9b59b6,
                'Tier 5': 0x2c3e50,
            };

            // Tworzenie embed
            const embed = new EmbedBuilder()
                .setColor(tierColors[tierWarna] || 0xe74c3c)
                .setTitle(`⚖️ Kara ${karaNumber}`)
                .setDescription('🕐 **Status:** Oczekuje na rozpatrzenie')
                .addFields(
                    { name: '📝 Nr. Kary', value: karaNumber, inline: true },
                    { name: '👮 Wystawiający', value: `<@${creatorId}>`, inline: true },
                    { name: '📅 Data', value: new Date().toLocaleString('pl-PL'), inline: true },
                    { name: '🚨 Funkcjonariusz', value: funkcjonariusz, inline: false },
                    { name: '📜 Paragraf', value: paragraf, inline: true },
                    { name: '⚠️ Tier', value: tierWarna, inline: true },
                    { name: '📋 Opis przewinienia', value: opis, inline: false }
                )
                .setFooter({ text: `Wystawione przez: ${interaction.user.tag} | Oczekuje na decyzję` })
                .setTimestamp();

            if (okolicznosci) {
                embed.addFields({ name: '⚖️ Okoliczności', value: okolicznosci, inline: false });
            }

            if (dowod.contentType && dowod.contentType.startsWith('image/')) {
                embed.setImage(dowod.url);
            }
            embed.addFields({ name: '📎 Dowód', value: `[${dowod.name}](${dowod.url})` });

            // Przyciski akcji
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`kara_accept_${karaNumber}`)
                        .setLabel('✅ Zaakceptuj')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`kara_reject_${karaNumber}`)
                        .setLabel('❌ Odrzuć')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`kara_modify_${karaNumber}`)
                        .setLabel('✏️ Zmień karę')
                        .setStyle(ButtonStyle.Primary)
                );

            try {
                await karyChannel.send({
                    content: `<@&${guildConfig.adminRole}> - Nowa kara do rozpatrzenia`,
                    embeds: [embed],
                    components: [actionRow]
                });

                await interaction.reply({
                    content: `✅ **Kara ${karaNumber} została wysłana do rozpatrzenia!**\n\n📋 Kanał: ${karyChannel}\n⏳ Oczekuje na decyzję administracji.`,
                    ephemeral: true
                });

            } catch (error) {
                console.error('[ERROR] Błąd wystawiania kary:', error);
                await interaction.reply({
                    content: '❌ Wystąpił błąd podczas wystawiania kary.',
                    ephemeral: true
                });
            }
            return;
        }

        // ===== MODAL: MODYFIKACJA KARY =====
        if (customId.startsWith('kara_modify_modal_')) {
            const karaNumber = customId.replace('kara_modify_modal_', '');
            const newTier = interaction.fields.getTextInputValue('new_tier');
            const reason = interaction.fields.getTextInputValue('reason');

            const tierColors = {
                'Upomnienie': 0x3498db,
                'Tier 1': 0xf1c40f,
                'Tier 2': 0xe67e22,
                'Tier 3': 0xe74c3c,
                'Tier 4': 0x9b59b6,
                'Tier 5': 0x2c3e50,
            };

            const originalEmbed = interaction.message.embeds[0];

            const fields = originalEmbed.fields.map(field => {
                if (field.name === '⚠️ Tier') {
                    return { ...field, value: newTier };
                }
                return field;
            });

            fields.push({
                name: '📝 Zmiana',
                value: `**Przez:** <@${interaction.user.id}>\n**Powód:** ${reason}`,
                inline: false
            });

            const updatedEmbed = EmbedBuilder.from(originalEmbed)
                .setColor(tierColors[newTier] || 0xe74c3c)
                .setDescription(`✏️ **Status:** Zmieniona przez <@${interaction.user.id}>`)
                .setFields(fields)
                .setFooter({ text: `Zmieniona: ${new Date().toLocaleString('pl-PL')}` });

            await interaction.update({
                embeds: [updatedEmbed],
                components: []
            });

            console.log(`[INFO] Kara ${karaNumber} zmieniona przez ${interaction.user.tag} na ${newTier}`);
        }
    }
});

// Logowanie bota
client.login(process.env.DISCORD_TOKEN);
