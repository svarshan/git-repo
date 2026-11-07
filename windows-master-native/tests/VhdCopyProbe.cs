using System;
using System.IO;
using System.Reflection;
class VhdCopyProbe {
 [STAThread] static int Main(string[] args){
  if(args.Length!=3)return 2;
  try{
   var asm=Assembly.LoadFrom(args[0]);var diskType=asm.GetType("MoOLVaMaster.UsbDisk",true);
   var info=diskType.GetMethod("FromRoot",BindingFlags.Public|BindingFlags.Static).Invoke(null,new object[]{args[2]});
   if(info==null||(uint)diskType.GetField("VolumeSerial").GetValue(info)==0)throw new Exception("WMI could not resolve VHD volume");
   var mountType=asm.GetType("MoOLVaMaster.IsoMount",true);
   using(var mount=(IDisposable)Activator.CreateInstance(mountType,new object[]{args[1]})){
    string source=(string)mountType.GetProperty("Root").GetValue(mount,null),target=args[2];
    var core=asm.GetType("MoOLVaMaster.MainForm",true).GetMethod("WriteUsbCore",BindingFlags.NonPublic|BindingFlags.Static);
    string[] files=Directory.GetFiles(source,"*",SearchOption.AllDirectories);
    core.Invoke(null,new object[]{source,target,files,Path.Combine(source,@"sources\install.wim"),false,new Action(()=>{}),new Progress<Tuple<int,string>>()});
    var verify=asm.GetType("MoOLVaMaster.UsbWriter",true).GetMethod("VerifyFiles",BindingFlags.NonPublic|BindingFlags.Static);
    if(verify==null)throw new Exception("USB verification method missing");
    uint serial=(uint)diskType.GetField("VolumeSerial").GetValue(info);
    object[] verifyArgs=new object[]{source,target,files,Path.Combine(source,@"sources\install.wim"),false,serial};
    verify.Invoke(null,verifyArgs);
    string damaged=Path.Combine(target,"setup.exe");byte[] bytes=File.ReadAllBytes(damaged);
    if(bytes.Length==0)throw new Exception("Empty fixture");
    bytes[0]^=0xff;File.SetAttributes(damaged,FileAttributes.Normal);File.WriteAllBytes(damaged,bytes);
    bool detected=false;
    try{verify.Invoke(null,verifyArgs);}catch(TargetInvocationException ex){if(ex.InnerException is IOException)detected=true;else throw;}
    if(!detected)throw new Exception("Same-size corruption was not detected");
    if(!File.Exists(Path.Combine(target,"setup.exe"))||!File.Exists(Path.Combine(target,@"sources\boot.wim"))||!File.Exists(Path.Combine(target,@"efi\boot\bootx64.efi")))throw new Exception("missing copied files");
   }
   Console.WriteLine("ISO fixture copied to VHD with application routine");return 0;
  }catch(Exception e){Console.Error.WriteLine(e);return 1;}
 }
}
