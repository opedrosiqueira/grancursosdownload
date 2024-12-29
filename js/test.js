const fileName = document.querySelector("h1").innerText.trim()
const resumos = document.querySelector("a[aria-label='Material em PDF']")
const slides = document.querySelector("a[aria-label='Baixar slide da aula']")

// se eu tento clicar em dois anchors, só o primeiro funciona
// resumos.click()
// slides.click()

/* se eu tento clicar em dois anchors, só o primeiro funciona
window.open(slides.href, '_blank');
window.open(resumos.href, '_blank');
*/

/* alternativa pra tentar clicar em dois anchors, fazendo esperar, mas mesmo assim não funcionou
setTimeout(() => {
    console.log(resumos)
    resumos.click()
    console.log("resumos prontos")

    setTimeout(() => {
        console.log(slides)
        slides.click()
        console.log("slides prontos")
    }, 2000)

}, 2000)
*/