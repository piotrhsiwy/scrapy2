netsh interface portproxy add v4tov4 listenport=443 listenaddress=0.0.0.0 connectport=443 connectaddress=172.25.10.104
netsh interface portproxy add v4tov4 listenport=80  listenaddress=0.0.0.0 connectport=80  connectaddress=172.25.10.104
netsh interface portproxy add v4tov4 listenport=22  listenaddress=0.0.0.0 connectport=22  connectaddress=172.25.10.104