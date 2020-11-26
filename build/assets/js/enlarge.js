
var modal = document.getElementById("modal")
var backdrop = document.getElementById("backdrop")

console.log(modal)

const enlarge = (element) => {
  console.log(element)
  var clone = element.cloneNode()
  modal.style.visibility = "visible"
  backdrop.style.visibility = "visible"
  backdrop.style.opacity = "1"
  modal.appendChild(clone)
}

const closeModal = () => {
  modal.innerHTML = ''
  modal.style.visibility="hidden"
  backdrop.style.opacity = "0";
  backdrop.style.visibility="hidden";
}
