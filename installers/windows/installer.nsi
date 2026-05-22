; Condenser NSIS installer script
; Requires: NSIS 3.x (makensis)

Unicode True

!define PRODUCT_NAME    "Condenser"
!define PRODUCT_VERSION "${VERSION}"
!define INSTALL_DIR     "$PROGRAMFILES64\Condenser"
!define TASK_NAME       "Condenser"
!define UNINSTALL_KEY   "Software\Microsoft\Windows\CurrentVersion\Uninstall\Condenser"

Name          "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile       "dist\installers\condenser-${VERSION}-windows-x64.exe"
InstallDir    "${INSTALL_DIR}"
RequestExecutionLevel admin
SetCompressor lzma

;--------------------------------
; Pages
Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

;--------------------------------
; Install
Section "Condenser" SEC_MAIN
  SetOutPath "$INSTDIR"

  ; Binary
  File "dist\bin\condenser-win-x64.exe"
  Rename "$INSTDIR\condenser-win-x64.exe" "$INSTDIR\condenser.exe"

  ; Batch wrapper (sets NODE_ENV=production)
  File "installers\windows\condenser.bat"

  ; Frontend build output
  File /r "dist\frontend"
  File /r "dist\plugins"

  ; Write uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; Add/Remove Programs entry
  WriteRegStr   HKLM "${UNINSTALL_KEY}" "DisplayName"    "${PRODUCT_NAME}"
  WriteRegStr   HKLM "${UNINSTALL_KEY}" "DisplayVersion"  "${PRODUCT_VERSION}"
  WriteRegStr   HKLM "${UNINSTALL_KEY}" "Publisher"       "kmturley"
  WriteRegStr   HKLM "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoRepair" 1

  ; Register a Task Scheduler task to start at user logon
  ExecWait 'schtasks /create /tn "${TASK_NAME}" /tr "\"$INSTDIR\condenser.bat\"" /sc ONLOGON /f /rl HIGHEST'

  ; Start the service immediately (run once now)
  Exec '"$INSTDIR\condenser.bat"'
SectionEnd

;--------------------------------
; Uninstall
Section "Uninstall"
  ; Stop and remove scheduled task
  ExecWait 'schtasks /end /tn "${TASK_NAME}"'
  ExecWait 'schtasks /delete /tn "${TASK_NAME}" /f'

  ; Remove files
  RMDir /r "$INSTDIR\dist"
  Delete "$INSTDIR\condenser.exe"
  Delete "$INSTDIR\condenser.bat"
  Delete "$INSTDIR\uninstall.exe"
  RMDir  "$INSTDIR"

  ; Remove registry entry
  DeleteRegKey HKLM "${UNINSTALL_KEY}"
SectionEnd
