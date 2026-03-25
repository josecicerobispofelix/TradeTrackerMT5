[Setup]
AppId={{B3F4A2D1-7C8E-4F2A-9B1D-3E6A5C0F8D2B}
AppName=TradeTracker MT5
AppVersion=1.0.4
AppPublisher=TecnoHuby
AppPublisherURL=https://tecnohuby.com.br
AppSupportURL=mailto:contato@tecnohuby.com.br
AppUpdatesURL=https://tecnohuby.com.br
DefaultDirName={localappdata}\TradersTrackerMT5
DefaultGroupName=TradeTracker MT5
DisableProgramGroupPage=yes
OutputDir=dist-installer
OutputBaseFilename=TradersTrackerMT5-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
SetupIconFile=assets\app.generated.ico
UninstallDisplayIcon={app}\app.ico
UninstallDisplayName=TradeTracker MT5
CreateUninstallRegKey=yes

[Files]
Source: "dist\TradersTrackerMT5\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion
Source: "TradersTrackerMT5.env"; DestDir: "{app}"; Flags: onlyifdoesntexist
Source: "assets\app.generated.ico"; DestDir: "{app}"; DestName: "app.ico"; Flags: ignoreversion

[Icons]
Name: "{group}\TradeTracker MT5"; Filename: "{app}\TradersTrackerMT5.exe"; IconFilename: "{app}\app.ico"
Name: "{userdesktop}\TradeTracker MT5"; Filename: "{app}\TradersTrackerMT5.exe"; IconFilename: "{app}\app.ico"
Name: "{group}\Desinstalar TradeTracker MT5"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\TradersTrackerMT5.exe"; Description: "Abrir TradeTracker MT5"; Flags: nowait postinstall skipifsilent
