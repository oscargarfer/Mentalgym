' Arranca el gimnasio sin dejar una ventana de consola en pantalla.
' El acceso directo del escritorio apunta aquí (a través de wscript.exe).
Option Explicit
Dim fso, shell, raiz
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
raiz = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
shell.CurrentDirectory = raiz
' 0 = ventana oculta, False = no esperar a que termine
shell.Run "cmd /c node """ & raiz & "\scripts\launch.mjs""", 0, False
