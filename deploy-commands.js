require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Ładowanie definicji komend
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`[INFO] Przygotowano komendę: ${command.data.name}`);
    }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Rejestracja komend
(async () => {
    try {
        console.log(`[INFO] Rozpoczynam rejestrację ${commands.length} komend...`);

        let data;

        if (process.env.GUILD_ID) {
            // Rejestracja dla konkretnego serwera (natychmiastowa)
            data = await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );
            console.log(`[OK] Zarejestrowano ${data.length} komend dla serwera ${process.env.GUILD_ID}`);
        } else {
            // Rejestracja globalna (może trwać do godziny)
            data = await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
            console.log(`[OK] Zarejestrowano ${data.length} komend globalnie`);
        }

    } catch (error) {
        console.error('[ERROR] Błąd podczas rejestracji komend:', error);
    }
})();
