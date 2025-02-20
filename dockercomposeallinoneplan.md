1) mirrotalk
    mirotalk/docker-compose.yml
2) ovenmediaengine
    ovenmediaengine/docker-compose.yml
    It would be good to use traefik to manage the live.johnrogerscolour.co.uk domain, which we should change to be live.colourstream.johnrogerscolour.co.uk so we should include this in the config, we don't need to proxy any ports but we do need to handle ovens config and the ssl certs that traefik provides which should be in seperate files or pem key formats if possible, rather than one json blob. 

    
3) the secret third thing, - Would be great to have a last container for colourstreams admin panel, password protected and avalible at colourstream.johnrogerscolour.co.uk/admin
    the admin panel would be used to adminster rooms and call into the api for mirotalk, 

