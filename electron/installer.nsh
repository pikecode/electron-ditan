!macro customHeader
  !ifdef BUILD_UNINSTALLER
    ; Some user environments modify or partially quarantine uninstall.exe,
    ; which makes NSIS self-check fail before our uninit macro can run.
    CRCCheck off
  !endif
!macroend

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customUnInit
  DetailPrint "Stopping EasyStitch processes..."
  !ifdef INSTALL_MODE_PER_ALL_USERS
    nsExec::Exec `taskkill /f /im "EasyStitch.exe"`
    nsExec::Exec `taskkill /f /im "crashpad_handler.exe"`
  !else
    nsExec::Exec `%SYSTEMROOT%\System32\cmd.exe /c taskkill /f /im "EasyStitch.exe" /fi "USERNAME eq %USERNAME%"`
    nsExec::Exec `%SYSTEMROOT%\System32\cmd.exe /c taskkill /f /im "crashpad_handler.exe" /fi "USERNAME eq %USERNAME%"`
  !endif
  Sleep 500
!macroend
