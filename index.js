

const fs = require("fs");
const { execFile , spawn ,execSync, execFileSync ,spawnSync} = require('child_process');

//路径配置
let config = {
    mp3_music_path :"./mp3_file/", //保存原始MP3文件
    temp_path : "./mixture_file/", //保存合成后的音乐文件
	ogg_path:"./ogg_file/" //输出ogg格式音乐
};

//获取音乐时间长度
function get_music_time(file)  {
    let music_infor = spawnSync('ffprobe', ["-v","quiet","-print_format","json","-show_format",file],{});
    return Math.ceil(JSON.parse(music_infor.stdout).format.duration);
}
//把时间转化成时分秒格式
function secondToDate(result) {
    let h = Math.floor(result / 3600);
    let m = Math.floor((result / 60 % 60));
    let s = Math.floor((result % 60));
    return result = h + ":" + m + ":" + s ;
}
//排序
function sortTag(a, b){
	let a_s = a.split("_");
	let b_s = b.split("_");
	return a_s[1] - b_s[1];
}

//rm -r 删除文件夹里面内容
function delete_dir_all_file(adir_path) {
    spawnSync('rm', ["-r",adir_path+"*",],{shell:true});//删除文件
}
//wav文件目录 input_wav_path
function music_slice(input_wav_path,wav_file_name,split_time,output_wav_path) {
    wav_file_name = wav_file_name.split(".")[0];//xxx.wav 分割
    let file_name = input_wav_path+wav_file_name+".wav";
    let audio_time = get_music_time(file_name);//获取音频的时间长度
    for(let slice_time = 0;slice_time < audio_time;slice_time += split_time) {
        let start_time,last_time,node_time_s,slice_name;
        if ((audio_time - slice_time) >= split_time) {
            start_time = secondToDate(slice_time);
            last_time = secondToDate(split_time);
            node_time_s = slice_time + split_time;
        } else {
            start_time = secondToDate(slice_time);
            last_time = secondToDate(audio_time - slice_time);
            node_time_s = audio_time;
        }
        slice_name = input_wav_path+wav_file_name+"_"+node_time_s+".wav";//分割之后保存的位置
        console.log(start_time+"<=>"+last_time+" FILE: "+slice_name);
        spawnSync('ffmpeg', ["-i",file_name,"-vn","-acodec","copy","-ss",start_time,"-t",last_time,slice_name],{});//分割音频
        spawnSync('python', ["separate_dsd.py","-i",slice_name,"-o",input_wav_path,"-m","model_dsd_fft_1024.pkl"],{});//AI分解处理
        spawnSync('ffmpeg',["-i",slice_name,"-i",input_wav_path+"bass.wav","-i",input_wav_path+"drums.wav","-i",input_wav_path+"vocals.wav","-i",input_wav_path+"other.wav","-filter_complex","[0:a][1:a][2:a][3:a][4:a]amerge=inputs=5,pan=octagonal|FL=c0|FR=c2+c3|FC=c1|BL=c5|BR=c3|BC=c4|SL=c4+c5|SR=c2[aout]","-map","[aout]",output_wav_path+wav_file_name+"_"+node_time_s+"_ai.wav"] ,{});//合并文件 这里c2 c3通道通过后面的通道进行融合叠加
        //删除分析文件
        try {
            fs.unlinkSync(slice_name);//删除分割文件
            fs.unlinkSync(input_wav_path+"bass.wav");//同步删除文件
            fs.unlinkSync(input_wav_path+"drums.wav");//同步删除文件
            fs.unlinkSync(input_wav_path+"vocals.wav");//同步删除文件
            fs.unlinkSync(input_wav_path+"other.wav");//同步删除文件
        }catch (err){
            console.log("delete error");
        }
        //break;
    }
	
}
//添加wav 转ogg的命令
function array_push_ffmpeg_cmd(array,count,output){
	let process_array = array;
	let format_str="";
	for(let i=0;i < count;i++){
		format_str += "["+i+":0]";
	}
	process_array.push("-filter_complex");
	process_array.push(format_str+"concat=n="+count+":v=0:a=1,pan=octagonal|FL=c0|FR=c1|FC=c2|BL=c3|BR=c4|BC=c5|SL=c6|SR=c7[a]");
	process_array.push("-map");
	process_array.push("[a]");
	process_array.push(output+".ogg");
	/*let process = spawn("ffmpeg",process_array).stderr.on('data', (data) => {
		console.log(`${output}: ${data}`);
	});*/
	spawnSync("ffmpeg",process_array);
}
//wav 转 ogg
function wav_conv_ogg(input_path,output_path) {
    let wav_file = fs.readdirSync(input_path,{});
	let file_name  = "";
	let file_array = [];
	let console_array=[];
	
    for(let index in wav_file){
        if(wav_file.hasOwnProperty(index)){
            if(wav_file[index].split(".")[1] === "wav"){	
				file_array.push(wav_file[index]);			
            }
			
        }	
    }
	file_array.sort(sortTag)
	for(let index in file_array){
		if(file_array.hasOwnProperty(index)){
			let object_name = file_array[index].split("_")[0];
			if(file_name !== object_name){
				if(index !== "0"){
					console.log(console_array);
					array_push_ffmpeg_cmd(console_array,console_array.length / 2,output_path + file_name.replace(/(^\s*)|(\s*$)/g, ""));
				}
				file_name = object_name;
				console_array=[];
			}
			console_array.push("-i");
			console_array.push(input_path+file_array[index]);
        }
	}
	array_push_ffmpeg_cmd(console_array,console_array.length / 2,output_path + file_name.replace(/(^\s*)|(\s*$)/g, ""));
}
//转化MP3为ogg
//ffmpeg -i test.mp3 -ac 2 -ar 44100 -acodec pcm_s16le ./test/test.wav
function mp3_conv_ogg(input_mp3_path,temp_path,output_ogg_path,channels,format,frequency) {
    let mp3_file = fs.readdirSync(input_mp3_path,{});
    for(let index in mp3_file){
        if(mp3_file.hasOwnProperty(index)){
			let music_name = mp3_file[index];
            let file_name = music_name.split(".");
			let temp_music_name = file_name[0]+" ";//临时保存的文件名称
            if(file_name[1] === "mp3" || file_name[1] === "wav"){
                spawnSync('ffmpeg', ["-i",input_mp3_path + music_name,"-ac",channels,"-acodec",format,"-ar",frequency,input_mp3_path+temp_music_name+".wav"],{});//MP3转WAV
				music_slice(input_mp3_path,temp_music_name,300,temp_path);//WAV转AI_WAV文件
				wav_conv_ogg(temp_path,output_ogg_path);//AI_WAV文件转OGG文件
				delete_dir_all_file(temp_path);//删除AI文件
				try{
					fs.unlinkSync(input_mp3_path+temp_music_name+".wav");//删除wav文件
				}catch(err){
					console.log("delete error");
				}
            }else{
				console.log("not found music file");
			}
			
        }
    }
}

/*只保存当前转化后的音频文件*/
//delete_dir_all_file(config.ogg_path);//删除转化后的文件
mp3_conv_ogg(config.mp3_music_path,config.temp_path,config.ogg_path,"2","pcm_s16le","44100");//MP3转wav
delete_dir_all_file(config.mp3_music_path);//删除mp3文件
