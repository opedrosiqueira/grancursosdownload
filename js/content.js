let database, page, curso, disciplina, conteudo, aula;

function queryDB(key, value) {
    console.log("consultando", key, value);
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(["aula"], 'readonly');
        const store = transaction.objectStore("aula");
        const index = store.index(key);
        const request = index.getAll(value);

        request.onsuccess = () => resolve(request.result); // Resolve with the result
        request.onerror = () => reject(request.error); // Reject on error
    });
}

function addToDB(data) {
    console.log("adicionando", data);
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(["aula"], 'readwrite');
        const store = transaction.objectStore("aula");
        const request = store.add(data);

        request.onsuccess = () => resolve(request.result); // Resolve with the result
        request.onerror = () => reject(request.error); // Reject on error
    });
}

function putToDB(data) {
    if (!data.id) throw new Error("{id} is required");
    console.log("atualizando", data.id, "com", data);
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(["aula"], 'readwrite');
        const store = transaction.objectStore("aula");
        const request = store.get(data.id)
        request.onsuccess = (event) => {
            if (!event.target.result) throw new Error("no data with id", data.id);
            const request = store.put({ ...event.target.result, ...data });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        };
        request.onerror = () => reject(request.error);
    });
}

async function updateDatabase(aula, tipo, filename, url) {
    const [arquivo] = await queryDB(tipo, filename);
    if (!arquivo) { await downloadFile(url, filename); }

    const [result] = await queryDB("materia", [curso, disciplina, conteudo, aula]);
    if (!result) await addToDB({ curso, disciplina, conteudo, aula, [tipo]: filename, [tipo + 'URL']: url });
    else if (result[tipo] == filename) console.log(`já baixado: ${filename}`)
    else await putToDB({ id: result.id, [tipo]: filename, [tipo + 'URL']: url });
}

async function downloadFile(url, filename) {
    console.log("baixando arquivo", filename);

    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(blobUrl);
}

async function baixarVideo(url) {
    const filename = url.match(/[^\/]+\.mp4/)[0]
    updateDatabase(aula, "video", filename, url);
}

async function baixarMaterial(label, tipo = "slide") {
    for (el of page.querySelectorAll("#lista-aulas > li")) {
        const material = el.querySelector(`a[aria-label="${label}"`) ?? el.querySelector(`a[href^="/aluno/espaco/${label}"]`)
        const aula = el.querySelector('span').innerText.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, '-')
        if (!material?.href || !aula) continue;

        const { url } = await fetch(material.href);
        const filename = url.split(/\/|\?/).at(-2);
        if (!filename) { console.log("erro ao extrair filename:", url); continue; }

        updateDatabase(aula, tipo, filename, url);
    }
}

async function loadDatabase() {
    page = document.querySelector('iframe').contentDocument
    curso = page.body.innerHTML.match(/Voltar para tela do curso: (.+?)"/)[1].replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, '-').trim()
    disciplina = page.body.innerHTML.match(/Disciplina selecionada: (.+?)"/)[1].replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, '-').trim()
    conteudo = page.body.innerHTML.match(/Conteúdo selecionado: (.+?)"/)[1].replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, '-').trim()
    aula = page.querySelector('h1').innerText.replace(/ \(código.*/, '').replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, '-').trim()

    if (!curso || !disciplina || !conteudo || !aula) {
        console.log("não conseguiu extrair curso", curso, "ou disciplina", disciplina, "ou conteudo", conteudo, "ou aula", aula)
        return
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.open("grancursos", 1);
        request.onerror = (event) => {
            reject(new Error(event.target.error?.message));
        };
        request.onsuccess = (event) => {
            resolve(event.target.result);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const aula = db.createObjectStore("aula", { keyPath: "id", autoIncrement: true });
            aula.createIndex('materia', ['curso', 'disciplina', 'conteudo', 'aula']);
            aula.createIndex("curso", "curso");
            aula.createIndex("disciplina", "disciplina");
            aula.createIndex("conteudo", "conteudo");
            aula.createIndex("aula", "aula");
            aula.createIndex("slide", "slide");
            aula.createIndex("resumo", "resumo");
            aula.createIndex("video", "video");
            aula.createIndex("slideURL", "slideURL");
            aula.createIndex("resumoURL", "resumoURL");
            aula.createIndex("videoURL", "videoURL");
        };
    });
}

async function salvarProgresso(fileName, contentType) {
    console.log("teste")
}

chrome.runtime.onMessage.addListener(
    async function (request, sender, sendResponse) {
        if (!database) database = await loadDatabase();

        if (request.fn == 'salvarProgresso') salvarProgresso('grancursos.csv', { 'text/csv': ['.csv'] })
        else if (request.fn == 'baixarVideo') await baixarVideo(page.querySelector("video").src.trim())
        else if (request.fn == 'baixarSlides') {
            await baixarMaterial("Baixar slide da aula")
            await baixarMaterial("download-apostila")
        } else if (request.fn == 'baixarResumos') {
            await baixarMaterial("Material em PDF", "resumo")
            await baixarMaterial("Baixar aula degravada", "resumo")
            await baixarMaterial("download-resumo", "resumo")
        }
        sendResponse({ success: "TRUE" });
        return true;
    });