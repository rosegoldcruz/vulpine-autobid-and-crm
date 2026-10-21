if(new URLSearchParams(location.search).get('embedded')==='1'){
 document.querySelector('nav[aria-label="Pricing workspace"]').style.display='none';
 document.getElementById('root').style.height='100%';
}
