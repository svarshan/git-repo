using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Management;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
namespace MoOLVaMaster {
sealed class UsbDisk {
 public string Root,Label,Model,Serial,Pnp;public uint VolumeSerial;public ulong Size,VolumeSize;public uint Partitions;
 public override string ToString(){return Root+"  "+Model+"  "+(Size/1073741824.0).ToString("N1")+" ГБ  S/N: "+Serial;}
 public static UsbDisk FromRoot(string root){
  if(String.IsNullOrEmpty(root)||!System.Text.RegularExpressions.Regex.IsMatch(root,@"^[A-Za-z]:\\$"))throw new IOException("Требуется локальный диск с буквой.");
  var d=new DriveInfo(root);if(!d.IsReady)throw new IOException("Диск не готов.");
  using(var logical=new ManagementObject("Win32_LogicalDisk.DeviceID='"+root.Substring(0,2)+"'")){
   var parts=logical.GetRelated("Win32_DiskPartition","Win32_LogicalDiskToPartition",null,null,null,null,false,null).Cast<ManagementObject>().ToList();
   if(parts.Count!=1)throw new IOException("Не удалось однозначно определить раздел диска "+root);
   var physical=parts[0].GetRelated("Win32_DiskDrive","Win32_DiskDriveToDiskPartition",null,null,null,null,false,null).Cast<ManagementObject>().ToList();
   if(physical.Count!=1)throw new IOException("Не удалось однозначно определить физический диск "+root);
   using(var p=physical[0])return new UsbDisk{Root=root.ToUpperInvariant(),Label=d.VolumeLabel,Model=Convert.ToString(p["Model"]),Serial=Convert.ToString(p["SerialNumber"]).Trim(),Pnp=Convert.ToString(p["PNPDeviceID"]),Size=Convert.ToUInt64(p["Size"]),VolumeSize=Convert.ToUInt64(parts[0]["Size"]),Partitions=Convert.ToUInt32(p["Partitions"]),VolumeSerial=VolumeId(root)};
  }
 }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool GetVolumeInformation(string root,System.Text.StringBuilder label,int size,out uint serial,out uint max,out uint flags,System.Text.StringBuilder fs,int fsSize);
 static uint VolumeId(string root){uint n,m,f;if(!GetVolumeInformation(root,null,0,out n,out m,out f,null,0))throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());return n;}
 public bool SameDevice(UsbDisk other){return other!=null&&Root==other.Root&&Pnp==other.Pnp&&Serial==other.Serial&&Size==other.Size&&VolumeSize==other.VolumeSize&&Partitions==other.Partitions;}
 public static bool Eligible(UsbDisk x,bool removable){return removable&&x!=null&&!String.IsNullOrWhiteSpace(x.Serial)&&!String.IsNullOrWhiteSpace(x.Pnp)&&x.Pnp.StartsWith("USB",StringComparison.OrdinalIgnoreCase)&&x.Partitions==1&&x.VolumeSerial!=0&&x.VolumeSize<=32UL*1024*1024*1024&&x.VolumeSize>=4UL*1024*1024*1024&&x.Size>=x.VolumeSize;}
 public static UsbDisk CheckedTarget(string root){var d=new DriveInfo(root);if(d.DriveType!=DriveType.Removable)throw new IOException("Разрешены только съёмные накопители.");var x=FromRoot(root);if(!Eligible(x,true))throw new IOException("Нужен USB с одним разделом 4–32 ГБ и определяемым серийным номером. Для накопителя большего размера нужен существующий раздел до 32 ГБ.");return x;}
 internal static bool SafetySelfTest(){var a=new UsbDisk{Root=@"E:\",Serial="A",Pnp=@"USBSTOR\one",Size=8UL*1024*1024*1024,VolumeSize=8UL*1024*1024*1024,Partitions=1,VolumeSerial=123};var b=new UsbDisk{Root=@"E:\",Serial="A",Pnp=@"USBSTOR\one",Size=8UL*1024*1024*1024,VolumeSize=8UL*1024*1024*1024,Partitions=1,VolumeSerial=123};if(!Eligible(a,true)||Eligible(a,false)||!a.SameDevice(b))return false;b.Size=64UL*1024*1024*1024;if(!Eligible(b,true))return false;b.VolumeSize=64UL*1024*1024*1024;if(Eligible(b,true))return false;b.Size=a.Size;b.VolumeSize=a.VolumeSize;b.Serial="B";if(a.SameDevice(b))return false;b.Serial="A";b.Partitions=2;if(Eligible(b,true)||a.SameDevice(b))return false;b.Partitions=1;b.Pnp=@"SCSI\disk";if(Eligible(b,true))return false;return true;}
}
sealed class UsbWriter:Form {
 readonly TextBox iso=new TextBox(),log=new TextBox();readonly ComboBox target=new ComboBox();readonly Button start=new Button(),choose=new Button(),refresh=new Button();readonly ProgressBar progress=new ProgressBar();bool busy;
 public UsbWriter(string initialIso){Text="MoOLVa 4.6 — запись установочной флешки";Size=new Size(940,690);StartPosition=FormStartPosition.CenterParent;MinimumSize=new Size(800,600);
 var title=new Label{Text="Все данные на выбранной флешке будут удалены. Поддерживается UEFI и USB с одним разделом 4–32 ГБ (сам накопитель может быть больше).",Location=new Point(20,15),Size=new Size(870,45)};Controls.Add(title);
 iso.SetBounds(20,65,670,28);iso.Text=initialIso??"";Controls.Add(iso);choose.Text="Выбрать ISO";choose.SetBounds(700,60,190,38);Controls.Add(choose);
 target.SetBounds(20,122,670,30);target.DropDownStyle=ComboBoxStyle.DropDownList;Controls.Add(target);refresh.Text="Обновить USB";refresh.SetBounds(700,116,190,38);Controls.Add(refresh);
 var hint=new Label{Location=new Point(20,175),Size=new Size(865,60),Text="Проверьте модель, размер и серийный номер. Подойдут только USB с одним разделом. Не выбирайте флешку с MoOLVa или ISO."};Controls.Add(hint);
 start.Text="Записать Windows на USB";start.SetBounds(20,240,290,43);Controls.Add(start);progress.SetBounds(20,305,870,24);Controls.Add(progress);log.SetBounds(20,350,870,250);log.Multiline=true;log.ReadOnly=true;log.ScrollBars=ScrollBars.Vertical;log.Anchor=AnchorStyles.Top|AnchorStyles.Bottom|AnchorStyles.Left|AnchorStyles.Right;Controls.Add(log);
 var saveLog=new Button{Text="Сохранить журнал",Location=new Point(325,240),Size=new Size(200,43)};Controls.Add(saveLog);saveLog.Click+=(s,e)=>{using(var d=new SaveFileDialog{FileName="MoOLVa-USB-Report.txt",Filter="Текстовый файл|*.txt"})if(d.ShowDialog(this)==DialogResult.OK)try{File.WriteAllText(d.FileName,"MoOLVa — отчёт записи USB\r\nДата: "+DateTime.Now+"\r\nISO: "+iso.Text+"\r\nНоситель: "+Convert.ToString(target.SelectedItem)+"\r\n\r\n"+log.Text,new System.Text.UTF8Encoding(true));}catch(Exception ex){MessageBox.Show(ex.Message);}};
 choose.Click+=(s,e)=>{using(var d=new OpenFileDialog{Filter="ISO-образы|*.iso"})if(d.ShowDialog()==DialogResult.OK)iso.Text=d.FileName;};refresh.Click+=(s,e)=>RefreshUsb();start.Click+=async(s,e)=>await StartWrite();FormClosing+=(s,e)=>{if(busy){e.Cancel=true;MessageBox.Show("Дождитесь завершения операции.");}};Shown+=(s,e)=>RefreshUsb();
 }
 void Print(string s){log.AppendText(s+Environment.NewLine);}
 void RefreshUsb(){target.Items.Clear();foreach(var drive in DriveInfo.GetDrives())try{if(drive.DriveType==DriveType.Removable&&drive.IsReady)target.Items.Add(UsbDisk.CheckedTarget(drive.Name));}catch{} if(target.Items.Count>0)target.SelectedIndex=0;else Print("Подходящие USB не найдены. Нужен USB с одним разделом размером 4–32 ГБ.");}
 static void Guard(UsbDisk chosen,string isoPath,bool checkSerial){
  var now=UsbDisk.CheckedTarget(chosen.Root);if(!chosen.SameDevice(now)||(checkSerial&&chosen.VolumeSerial!=now.VolumeSerial))throw new IOException("Флешка изменилась после выбора. Обновите список.");
  foreach(string p in new[]{Path.GetFullPath(isoPath),Application.ExecutablePath,Environment.SystemDirectory,Path.GetTempPath(),Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)}){string root=Path.GetPathRoot(p);var src=UsbDisk.FromRoot(root);if(String.Equals(src.Pnp,now.Pnp,StringComparison.OrdinalIgnoreCase))throw new IOException("Этот физический диск содержит ISO, MoOLVa или Windows. Выберите другую флешку.");}
 }
 async Task StartWrite(){var chosen=target.SelectedItem as UsbDisk;if(chosen==null){MessageBox.Show("Выберите USB.");return;}string path=iso.Text.Trim();if(!File.Exists(path)||!path.EndsWith(".iso",StringComparison.OrdinalIgnoreCase)){MessageBox.Show("Выберите существующий ISO.");return;}
 if(!new WindowsPrincipalAdapter().Admin){MessageBox.Show("Запустите MoOLVa от имени администратора и откройте мастер снова.");return;}
 busy=true;start.Enabled=false;refresh.Enabled=false;choose.Enabled=false;target.Enabled=false;IsoMount mounted=null;
 try{
  Print("Проверка выбранного диска и подключение ISO...");Guard(chosen,path,true);mounted=await Task.Run(()=>new IsoMount(path));string from=mounted.Root;
  string wim=Path.Combine(from,@"sources\install.wim");bool split=false;string efi=Path.Combine(from,@"efi\boot");
  if(!File.Exists(Path.Combine(from,"setup.exe"))||!File.Exists(Path.Combine(from,@"sources\boot.wim"))||!(File.Exists(Path.Combine(efi,"bootx64.efi"))||File.Exists(Path.Combine(efi,"bootaa64.efi"))))throw new IOException("В ISO отсутствуют необходимые установочные UEFI-файлы.");
  if(!(File.Exists(wim)||File.Exists(Path.Combine(from,@"sources\install.esd"))||File.Exists(Path.Combine(from,@"sources\install.swm"))))throw new IOException("Не найден install.wim, install.esd или install.swm.");
  string[] files=Directory.GetFiles(from,"*",SearchOption.AllDirectories);long bytes=0;foreach(string file in files){long n=new FileInfo(file).Length;bytes+=n;if(n>4294967295L){if(String.Equals(file,wim,StringComparison.OrdinalIgnoreCase))split=true;else throw new IOException("Файл больше 4 ГБ не поддерживается FAT32: "+file);}}
  if((ulong)(bytes+536870912L)>(ulong)new DriveInfo(chosen.Root).TotalSize)throw new IOException("Образ слишком велик для выбранного раздела флешки.");
  string prompt="ВСЕ ДАННЫЕ на флешке будут удалены!\r\n"+chosen+"\r\nМетка: "+chosen.Label+"\r\nISO: "+path+"\r\n\r\nПродолжить?";
  if(MessageBox.Show(prompt,"Форматирование USB",MessageBoxButtons.YesNo,MessageBoxIcon.Warning)!=DialogResult.Yes)return;
  using(var confirm=new Form{Text="Подтверждение удаления",Size=new Size(540,180),StartPosition=FormStartPosition.CenterParent,FormBorderStyle=FormBorderStyle.FixedDialog,MinimizeBox=false,MaximizeBox=false}){
   var l=new Label{Text="Введите точно: УДАЛИТЬ "+chosen.Root.Substring(0,2),Location=new Point(15,15),Size=new Size(490,25)};var t=new TextBox{Location=new Point(15,45),Width=490};var ok=new Button{Text="Подтвердить",DialogResult=DialogResult.OK,Location=new Point(15,80),Width=150};confirm.Controls.AddRange(new Control[]{l,t,ok});confirm.AcceptButton=ok;
   if(confirm.ShowDialog(this)!=DialogResult.OK||t.Text.Trim()!="УДАЛИТЬ "+chosen.Root.Substring(0,2)){Print("Операция отменена.");return;}
  }
  Guard(chosen,path,true);Print("Форматирование выбранного тома FAT32...");await Task.Run(()=>FormatSelected(chosen));
  var after=UsbDisk.CheckedTarget(chosen.Root);if(!chosen.SameDevice(after)||after.VolumeSerial==chosen.VolumeSerial||new DriveInfo(chosen.Root).DriveFormat!="FAT32"||new DriveInfo(chosen.Root).VolumeLabel!="MOOLVA_WIN")throw new IOException("Не удалось подтвердить результат форматирования. Запись остановлена.");
  Guard(after,path,true);var serial=after.VolumeSerial;var pr=new Progress<Tuple<int,string>>(p=>{progress.Value=Math.Max(0,Math.Min(100,p.Item1));Print(p.Item2);});
  Print("Копирование установочных файлов...");await Task.Run(()=>MainForm.WriteUsb(from,after.Root,files,wim,split,serial,pr));
  Print("Проверка размеров и SHA-256 записанных файлов. Это может занять продолжительное время...");await Task.Run(()=>VerifyFiles(from,after.Root,files,wim,split,serial));
  progress.Value=100;Print(split?"Другие файлы проверены по SHA-256; у SWM проверены заголовки и комплектность частей. Целостность данных SWM и загрузка UEFI не подтверждены.":"Файлы проверены по SHA-256. Проверьте фактическую загрузку через UEFI.");MessageBox.Show("Запись завершена. Проверьте загрузку флешки на тестовом компьютере.");
 }catch(Exception ex){Print("Операция не завершена: "+ex.Message);MessageBox.Show("Операция не завершена: "+ex.Message+"\r\nЕсли форматирование уже началось, носитель может быть пустым или содержать неполные файлы.");}
 finally{if(mounted!=null)mounted.Dispose();busy=false;start.Enabled=true;refresh.Enabled=true;choose.Enabled=true;target.Enabled=true;}
 }
 static void FormatSelected(UsbDisk expected){
  var verify=UsbDisk.CheckedTarget(expected.Root);if(!expected.SameDevice(verify)||verify.VolumeSerial!=expected.VolumeSerial)throw new IOException("Флешка изменилась до форматирования.");
  FormatVolumeUnchecked(expected.Root);
 }
 static void FormatVolumeUnchecked(string root){
  string letter=root.Substring(0,1);if(!System.Text.RegularExpressions.Regex.IsMatch(letter,"^[A-Z]$"))throw new IOException("Некорректная буква диска.");
  string file=Path.Combine(Path.GetTempPath(),"MoOLVa-format-"+Guid.NewGuid().ToString("N")+".txt");try{File.WriteAllText(file,"select volume "+letter+"\r\nformat fs=fat32 quick label=MOOLVA_WIN override\r\nexit\r\n",System.Text.Encoding.ASCII);
   using(var p=Process.Start(new ProcessStartInfo("diskpart.exe","/s \""+file+"\""){UseShellExecute=false,CreateNoWindow=true})){if(!p.WaitForExit(180000)){try{p.Kill();}catch{}throw new IOException("Превышено время форматирования.");}if(p.ExitCode!=0)throw new IOException("DiskPart сообщил код "+p.ExitCode);}
  }finally{try{File.Delete(file);}catch{}}
 }
 static void VerifyFiles(string source,string dest,string[] files,string wim,bool split,uint serial){
  foreach(var file in files){if(MainForm.VolumeSerial(dest)!=serial)throw new IOException("Флешка изменилась при проверке.");if(split&&String.Equals(file,wim,StringComparison.OrdinalIgnoreCase))continue;string result=Path.Combine(dest,file.Substring(source.Length));if(!File.Exists(result)||new FileInfo(result).Length!=new FileInfo(file).Length)throw new IOException("Не совпал размер файла: "+file);
  using(var sourceStream=File.OpenRead(file))using(var destinationStream=File.OpenRead(result))using(var sha=SHA256.Create()){byte[] originalHash=sha.ComputeHash(sourceStream);byte[] copiedHash=sha.ComputeHash(destinationStream);if(!originalHash.SequenceEqual(copiedHash))throw new IOException("Не совпадает SHA-256 файла: "+file);}
  if(MainForm.VolumeSerial(dest)!=serial)throw new IOException("Флешка изменилась при проверке.");}
  if(split||File.Exists(Path.Combine(source,@"sources\install.swm")))SplitParts.Validate(Path.Combine(dest,"sources"),()=>{if(MainForm.VolumeSerial(dest)!=serial)throw new IOException("Флешка изменилась при проверке.");});
 }
 sealed class WindowsPrincipalAdapter {public bool Admin{get{using(var id=System.Security.Principal.WindowsIdentity.GetCurrent())return new System.Security.Principal.WindowsPrincipal(id).IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);}}}
}
static class SplitParts {
 public static int Validate(string dir,Action guard){string first=Path.Combine(dir,"install.swm");if(!File.Exists(first))throw new IOException("Не найдена первая часть install.swm.");int total=0;byte[] id=null;
  for(int i=1;i<=Math.Max(1,total);i++){guard();string name=i==1?"install.swm":"install"+i+".swm";string path=Path.Combine(dir,name);if(!File.Exists(path))throw new IOException("Отсутствует часть "+name);using(var stream=File.OpenRead(path))using(var reader=new BinaryReader(stream)){if(stream.Length<208)throw new IOException("Слишком короткая часть "+name);byte[] header=reader.ReadBytes(44);byte[] magic={77,83,87,73,77,0,0,0};if(!header.Take(8).SequenceEqual(magic)||BitConverter.ToUInt32(header,8)<208)throw new IOException("Некорректный заголовок "+name);int number=BitConverter.ToUInt16(header,40),count=BitConverter.ToUInt16(header,42);byte[] guid=header.Skip(24).Take(16).ToArray();if(i==1){total=count;id=guid;if(total<1||total>10000)throw new IOException("Некорректное число частей WIM.");}if(number!=i||count!=total||!guid.SequenceEqual(id))throw new IOException("Часть WIM не соответствует комплекту: "+name);}}
  return total;
 }
 internal static bool SelfTest(){string dir=Path.Combine(Path.GetTempPath(),"MoOLVaSplit-"+Guid.NewGuid().ToString("N"));try{Directory.CreateDirectory(dir);byte[] h=new byte[208];byte[] magic={77,83,87,73,77,0,0,0};Array.Copy(magic,h,8);Array.Copy(BitConverter.GetBytes((uint)208),0,h,8,4);h[24]=42;Array.Copy(BitConverter.GetBytes((ushort)2),0,h,42,2);Array.Copy(BitConverter.GetBytes((ushort)1),0,h,40,2);File.WriteAllBytes(Path.Combine(dir,"install.swm"),h);try{Validate(dir,()=>{});return false;}catch(IOException){}Array.Copy(BitConverter.GetBytes((ushort)2),0,h,40,2);File.WriteAllBytes(Path.Combine(dir,"install2.swm"),h);if(Validate(dir,()=>{})!=2)return false;h[24]=43;File.WriteAllBytes(Path.Combine(dir,"install2.swm"),h);try{Validate(dir,()=>{});return false;}catch(IOException){return true;}}finally{if(Directory.Exists(dir))Directory.Delete(dir,true);}}
}
}
