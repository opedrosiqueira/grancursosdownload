let database;
let page;
let disciplina;
let conteudo;
let aula;

async function baixarVideo(url) {
    const filename = url.match(/[^\/]+\.mp4/)[0]
    if (!database.includes(filename)) {
        console.log("baixando vídeo", filename);

        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(blobUrl);
    }

    if (database.includes(`${disciplina};${conteudo};${aula};${filename}`)) {
        console.log(filename, "já baixado!")
        return
    } else if (database.includes(`${disciplina};${conteudo};${aula}`)) {
        console.log("acrescentando", filename, "na aula", aula)
        const index = database.indexOf(`${disciplina};${conteudo};${aula}`) + (`${disciplina};${conteudo};${aula}`).length
        database = database.slice(0, index) + ';' + filename + database.slice(index)
    } else {
        console.log("acrescentando", disciplina, conteudo, aula, filename);
        database += `\n${disciplina};${conteudo};${aula};${filename};;`
    }
}

function updateDatabase(disciplina, conteudo, aula, url, i) {
    const match = database.match(`(${disciplina};${conteudo};${aula})(;.*?)(;.*?)(;.*?)`)
    if (!match) {
        console.log("adicionando", disciplina, conteudo, aula, url)
        database += `\n${disciplina};${conteudo};${aula}`
        database += i == 2 ? `;${url};;` : i == 3 ? `;;${url};` : `;;;${url}`
        return;
    }

    url = ";" + url;
    if (match[i] == url) {
        console.log(`já baixado: ${match[i]}`)
        return
    }

    const groups = i == 2 ? url + match[3] + match[4] :
        i == 3 ? match[2] + url + match[4] :
            match[2] + match[3] + url;

    console.log(`atualizando: ${match[1]}`)
    const index = database.indexOf(match[1]) + match[1].length;
    database = database.slice(0, index) + groups + database.slice(index + (match[0]).length)
}

async function baixarMaterial(label, isSlide = true) {
    for (el of page.querySelectorAll("#lista-aulas > li")) {
        ok = false;
        const material = el.querySelector(`a[aria-label="${label}"`) ?? el.querySelector(`a[href^="/aluno/espaco/${label}"]`)
        if (!material?.href) continue;

        // parei aqui. qual escolher?
        
        // alternativa 1
        // const { url } = await fetch(material.href);
        // const link = document.createElement('a');
        // link.href = url;
        // link.download = 'file.pdf';
        // link.dispatchEvent(new MouseEvent('click'));

        // alternativa 2
        // const response = await fetch(url);
        // const blob = await response.blob();
        // const blobUrl = URL.createObjectURL(blob);

        // const a = document.createElement('a');
        // a.href = blobUrl;
        // a.download = filename;
        // document.body.appendChild(a);
        // a.click();
        // document.body.removeChild(a);

        // URL.revokeObjectURL(blobUrl);


        // else if (!database.includes(material?.href)) {
        //     const aula = el.querySelector('span').innerText.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, '-')
        //     ok = (await chrome.runtime.sendMessage({ savepdf: { url: material.href } })).ok;
        // } else {
        //     ok = true;
        // }

        // if (ok) {
        //     updateDatabase(disciplina, conteudo, aula, material.url, isSlide ? 2 : 3);
        // } else {
        //     console.log(`erro ao baixar: ${material.url}`);
        // }
    }
}

async function loadDatabase() {
    return new Promise((resolve, reject) => {
        // Create a hidden input element of type 'file'
        const fileInput = document.createElement('input');
        fileInput.type = 'file';

        // Optionally, set file input attributes
        fileInput.accept = '.csv'; // Restrict file types (e.g., .txt, .pdf)
        // fileInput.multiple = true; // Allow multiple file selection

        // Listen for file selection
        fileInput.addEventListener('change', (event) => {
            const files = event.target.files; // Get the selected files
            if (files.length === 0) {
                reject(new Error('No file selected'));
                return;
            }

            const file = files[0]; // Take the first selected file
            const reader = new FileReader();

            // Handle successful reading
            reader.onload = function (e) {
                const database = e.target.result;
                resolve(database); // Resolve the promise with the parsed content
            };

            // Handle reading errors
            reader.onerror = function () {
                reject(new Error('Failed to read the file'));
            };

            // Trigger reading the file
            reader.readAsText(file);
        });

        // Trigger the file dialog
        fileInput.click();
    });
}

async function salvarProgresso(fileName, contentType) {
    const response = await fetch('https://www.grancursosonline.com.br/aluno/espaco/download-apostila/codigo/mT71cgR2NDc%3D/c/M1iEBvYTFqE%3D')
    const blob = await response.blob();
    try {
        // Open the save file dialog
        const fileHandle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [
                {
                    description: 'CSV file',
                    accept: contentType
                }
            ]
        });

        // Create a writable stream
        const writableStream = await fileHandle.createWritable();

        // Write the file content
        await writableStream.write(database);

        // Close the writable stream
        await writableStream.close();

        console.log('File saved successfully!');
    } catch (error) {
        console.error('Error saving file:', error);
    }
}

chrome.runtime.onMessage.addListener(
    async function (request, sender, sendResponse) {
        if (!disciplina || !aula || !conteudo) {
            console.log("não conseguiu extrair disciplina", disciplina, "ou aula", aula, "ou conteudo", conteudo)
            return
        }
        if (!database) database = await loadDatabase();

        if (request.fn == 'salvarProgresso') salvarProgresso('grancursos.csv', { 'text/csv': ['.csv'] })
        else if (request.fn == 'baixarVideo') await baixarVideo(page.querySelector("video").src.trim())
        else if (request.fn == 'baixarSlides') {
            await baixarMaterial("Baixar slide da aula")
            await baixarMaterial("download-apostila")
        } else if (request.fn == 'baixarResumos') {
            await baixarMaterial("Material em PDF", false)
            await baixarMaterial("Baixar aula degravada", false)
            await baixarMaterial("download-resumo", false)
        }
        sendResponse({ success: "TRUE" });
        return true;
    });

window.addEventListener('load', (event) => {
    page = document.querySelector('iframe').contentDocument
    disciplina = page.body.innerHTML.match(/Disciplina selecionada: (.+?)"/)[1].replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, '-').trim()
    conteudo = page.body.innerHTML.match(/Conteúdo selecionado: (.+?)"/)[1].replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, '-').trim()
    aula = page.querySelector('h1').innerText.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, '-').trim()
});