[Setup]
AppName=TradeTrackerMT5
AppVersion=1.0.0
AppPublisher=CodMotion
DefaultDirName={localappdata}\TradeTrackerMT5
DefaultGroupName=TradeTrackerMT5
DisableProgramGroupPage=yes
OutputDir=dist-installer
OutputBaseFilename=TradeTrackerMT5-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na area de trabalho"; GroupDescription: "Atalhos:"

[Files]
Source: "dist\TradeTrackerMT5\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion
Source: "TradeTrackerMT5.env"; DestDir: "{app}"; Flags: onlyifdoesntexist

[Icons]
Name: "{group}\TradeTrackerMT5"; Filename: "{app}\TradeTrackerMT5.exe"
Name: "{userdesktop}\TradeTrackerMT5"; Filename: "{app}\TradeTrackerMT5.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\TradeTrackerMT5.exe"; Description: "Abrir TradeTrackerMT5"; Flags: nowait postinstall skipifsilent
