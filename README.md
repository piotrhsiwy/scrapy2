This is my personal project. Below I shortly explain its most important parts.

It consists of 5 modules. **cloud-init.yml** script is used to deploy all of them on a remote server.
  1) **hunt.js** script is an entrypoint to a module that "hunts" urls and saves them in a database, to be scraped later
  2) **scrape.js** script is an entrypoint to a module that scrapes market (and meta) data from each of the previously "hunted" urls and saves it in a database
  3) **calc.js script** is an entrypoint to a module that extracts market data from a database, uses statistics and other heuristics to judge whether there is an incosistancy present in the data, big enough, so that it would allow for making a profit by exploiting it
  4) the database is running inside a docker container defined in a **docker-compose.yml** file. All database related scripts are inside the **data/** directory
  5) **server.js** script runs a API to serve data about the incosistencies to a website. The website is in **data/index.html**

To review the code, I recommend starting at the entry script and going from there.

Because of different restrictions and site structures throughout the books, I decided to go for an architecture, where each of the books has got a separate scraping and hunting module, as well as sportname and marketname mappings in the **books/** directory.

Piotr
