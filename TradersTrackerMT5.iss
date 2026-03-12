[Setup]
AppName=TradersTrackerMT5
AppVersion=1.0.4
AppPublisher=CodMotion
DefaultDirName={localappdata}\TradersTrackerMT5
DefaultGroupName=TradersTrackerMT5
DisableProgramGroupPage=yes
OutputDir=dist-installer
OutputBaseFilename=TradersTrackerMT5-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
SetupIconFile=assets\app.generated.ico
UninstallDisplayIcon={app}\app-1.0.4.ico

[Files]
Source: "dist\TradersTrackerMT5\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion
Source: "TradersTrackerMT5.env"; DestDir: "{app}"; Flags: onlyifdoesntexist
Source: "assets\app.generated.ico"; DestDir: "{app}"; DestName: "app.ico"; Flags: ignoreversion
Source: "assets\app.generated.ico"; DestDir: "{app}"; DestName: "app-1.0.4.ico"; Flags: ignoreversion

[Icons]
Name: "{group}\TradersTrackerMT5"; Filename: "{app}\TradersTrackerMT5.exe"; IconFilename: "{app}\app-1.0.4.ico"
Name: "{userdesktop}\TradersTrackerMT5"; Filename: "{app}\TradersTrackerMT5.exe"; IconFilename: "{app}\app-1.0.4.ico"

[Run]
Filename: "{app}\TradersTrackerMT5.exe"; Description: "Abrir TradersTrackerMT5"; Flags: nowait postinstall skipifsilent
