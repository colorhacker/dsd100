
const fs = require("fs");
//const WavEncoder = require("wav-encoder");
//const WavDecoder = require("wav-decoder");
const { execFile , spawn ,execSync, execFileSync ,spawnSync} = require('child_process');
/*
ffmpeg -i 1.wav -acodec libvorbis audio.ogg
ffmpeg -i 1.wav -c libvorbis out.ogg
ffmpeg -i 2.wav -af "pan=7.1|FL=c0|FR=c1|FC=c2|LFE=c3|BL=c4|BR=c5|SL=c6|SR=c7" out1.ogg
*/
function sortNumber(a, b)
{
	return a - b;
}
function sortTag(a, b){
	let a_s = a.split("_");
	let b_s = b.split("_");
	let a_t = (a.split("（")[1]).split("）")[0];
	let b_t = (b.split("（")[1]).split("）")[0];
	if(a_s[0] === b_s[0]){
		return a_s[1] - b_s[1];
	}else{
		return a_t - b_t;
	}
}

function array_push_ffmpeg_cmd(array,count,output){
	let process_array = array;
	let format_str="";
	for(let i=0;i < count;i++){
		format_str += "["+i+":0]";
	}
	process_array.push("-filter_complex");
	process_array.push(format_str+"concat=n="+count+":v=0:a=1,pan=octagonal|FL=c0|FR=c2|FC=c1|BL=c7|BR=c5|BC=c6|SL=c3|SR=c4[a]");
	process_array.push("-map");
	process_array.push("[a]");
	process_array.push(output+".ogg");
	let process = spawn("ffmpeg",process_array).stderr.on('data', (data) => {
		console.log(`${output}: ${data}`);
	});
}

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
					array_push_ffmpeg_cmd(console_array,console_array.length / 2,file_name);
				}
				file_name = object_name;
				console_array=[];
			}
			console_array.push("-i");
			console_array.push(file_array[index]);
        }
	}
	array_push_ffmpeg_cmd(console_array,console_array.length / 2,file_name);
}

wav_conv_ogg("./","./");