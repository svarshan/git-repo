[Setup]
AppId={{F9271E53-1B63-4A95-A49C-F6525D18C4F4}
AppName=MoOLVa Windows Master
AppVersion=4.6-preview
AppPublisher=MoOLVa
DefaultDirName={localappdata}\Programs\MoOLVa Windows Master
DefaultGroupName=MoOLVa Windows Master
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=MoOLVa-Windows-Master-4.5-Preview-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\MoOLVa-Windows-Master.exe
[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
[Files]
Source: "..\dist\MoOLVa-Windows-Master-4.0-preview-Portable.exe"; DestDir: "{app}"; DestName: "MoOLVa-Windows-Master.exe"; Flags: ignoreversion
Source: "README.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\WebView2-LICENSE.txt"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
[Icons]
Name: "{group}\MoOLVa Windows Master"; Filename: "{app}\MoOLVa-Windows-Master.exe"
Name: "{autodesktop}\MoOLVa Windows Master"; Filename: "{app}\MoOLVa-Windows-Master.exe"; Tasks: desktopicon
[Tasks]
Name: "desktopicon"; Description: "Создать ярлык на рабочем столе"; Flags: unchecked
[Run]
Filename: "{app}\MoOLVa-Windows-Master.exe"; Description: "Запустить MoOLVa Windows Master"; Flags: nowait postinstall skipifsilent
