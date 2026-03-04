[Setup]
AppName=TradeTrackerMT5
AppVersion=1.0.4
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
SetupIconFile=assets\app.generated.ico
UninstallDisplayIcon={app}\app-1.0.4.ico

[Files]
Source: "dist\TradeTrackerMT5\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion
Source: "TradeTrackerMT5.env"; DestDir: "{app}"; Flags: onlyifdoesntexist
Source: "assets\app.generated.ico"; DestDir: "{app}"; DestName: "app.ico"; Flags: ignoreversion
Source: "assets\app.generated.ico"; DestDir: "{app}"; DestName: "app-1.0.4.ico"; Flags: ignoreversion

[Icons]
Name: "{group}\TradeTrackerMT5"; Filename: "{app}\TradeTrackerMT5.exe"; IconFilename: "{app}\app-1.0.4.ico"
Name: "{userdesktop}\TradeTrackerMT5"; Filename: "{app}\TradeTrackerMT5.exe"; IconFilename: "{app}\app-1.0.4.ico"

[Run]
Filename: "{app}\TradeTrackerMT5.exe"; Description: "Abrir TradeTrackerMT5"; Flags: nowait postinstall skipifsilent
