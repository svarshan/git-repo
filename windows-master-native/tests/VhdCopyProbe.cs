using System;
using System.IO;
using System.Reflection;
class VhdCopyProbe {
 [STAThread] static int Main(string[] args){
  if(args.Length!=3)return 2;
  try{
   var asm=Assembly.LoadFrom(args[0]);var mountType=asm.GetType("MoOLVaMaster.IsoMount",true);
   using(var mount=(IDisposable)Activator.CreateInstance(mountType,new object[]{args[1]})){
    string source=(string)mountType.GetProperty("Root").GetValue(mount,null),target=args[2];
    var core=asm.GetType("MoOLVaMaster.MainForm",true).GetMethod("WriteUsbCore",BindingFlags.NonPublic|BindingFlags.Static);
    string[] files=Directory.GetFiles(source,"*",SearchOption.AllDirectories);
    core.Invoke(null,new object[]{source,target,files,Path.Combine(source,@"sources\install.wim"),false,new Action(()=>{}),new Progress<Tuple<int,string>>()});
    if(!File.Exists(Path.Combine(target,"setup.exe"))||!File.Exists(Path.Combine(target,@"sources\boot.wim"))||!File.Exists(Path.Combine(target,@"efi\boot\bootx64.efi")))throw new Exception("missing copied files");
   }
   Console.WriteLine("ISO fixture copied to VHD with application routine");return 0;
  }catch(Exception e){Console.Error.WriteLine(e);return 1;}
 }
}
