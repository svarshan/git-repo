using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
namespace MoOLVaMaster {
sealed class IsoMount:IDisposable {
 [StructLayout(LayoutKind.Sequential)] struct StorageType{public uint DeviceId;public Guid VendorId;}
 [StructLayout(LayoutKind.Sequential)] struct AttachParameters{public uint Version;public uint Reserved;}
 [DllImport("virtdisk.dll",CharSet=CharSet.Unicode)]static extern uint OpenVirtualDisk(ref StorageType type,string path,uint access,uint flags,IntPtr parameters,out SafeFileHandle handle);
 [DllImport("virtdisk.dll")]static extern uint AttachVirtualDisk(SafeFileHandle handle,IntPtr sd,uint flags,uint provider,ref AttachParameters parameters,IntPtr overlapped);
 [DllImport("virtdisk.dll",CharSet=CharSet.Unicode)]static extern uint GetVirtualDiskPhysicalPath(SafeFileHandle handle,ref uint size,StringBuilder path);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern uint QueryDosDevice(string name,StringBuilder target,uint max);
 SafeFileHandle handle;public string Root{get;private set;}
 public IsoMount(string file){
  if(!File.Exists(file)||!file.EndsWith(".iso",StringComparison.OrdinalIgnoreCase))throw new IOException("Выберите существующий ISO-файл.");
  StorageType type=new StorageType{DeviceId=1,VendorId=new Guid("EC984AEC-A0F9-47E9-901F-71415A66345B")};
  uint rc=OpenVirtualDisk(ref type,Path.GetFullPath(file),0x000d0000,0,IntPtr.Zero,out handle);if(rc!=0)throw new System.ComponentModel.Win32Exception((int)rc,"Не удалось открыть ISO. Если он уже подключён, отключите его и повторите.");
  try {
   var p=new AttachParameters{Version=1};rc=AttachVirtualDisk(handle,IntPtr.Zero,1,0,ref p,IntPtr.Zero);if(rc!=0)throw new System.ComponentModel.Win32Exception((int)rc,"Не удалось подключить ISO.");
   uint size=1024;var physical=new StringBuilder(512);rc=GetVirtualDiskPhysicalPath(handle,ref size,physical);if(rc!=0)throw new System.ComponentModel.Win32Exception((int)rc,"Не удалось определить устройство ISO.");
   string raw=physical.ToString();int ix=raw.IndexOf("CDROM",StringComparison.OrdinalIgnoreCase);if(ix<0)throw new IOException("Подключённый ISO не распознан как виртуальный DVD: "+raw);
   string dos=raw.Substring(ix);var expectedBuffer=new StringBuilder(2048);if(QueryDosDevice(dos,expectedBuffer,(uint)expectedBuffer.Capacity)==0)throw new IOException("Не удалось сопоставить виртуальный DVD с устройством.");string expected=expectedBuffer.ToString();
   for(int attempt=0;attempt<20 && Root==null;attempt++){foreach(DriveInfo drive in DriveInfo.GetDrives()){if(drive.DriveType!=DriveType.CDRom)continue;var actual=new StringBuilder(2048);string name=drive.Name.Substring(0,2);if(QueryDosDevice(name,actual,(uint)actual.Capacity)!=0 && String.Equals(actual.ToString(),expected,StringComparison.OrdinalIgnoreCase)){Root=drive.Name;break;}}if(Root==null)Thread.Sleep(500);}
   if(Root==null)throw new IOException("Для ISO не появилась буква диска. Проверьте автоматическое подключение томов Windows.");
  } catch {Dispose();throw;}
 }
 public void Dispose(){if(handle!=null){handle.Dispose();handle=null;}}
}
}
