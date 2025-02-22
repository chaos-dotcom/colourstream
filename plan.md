# ColourStream Project Plan

**Task:** Build a live page with Ovenplayer and Mirotalk, secured behind a password-protected admin portal, all integrated with Traefik.

**Prompt:**
Now it's time to build the colourstream end product, 
I am looking for a live page which has both the ovenplayer player which is in the ovenplayer folder and has the actual .js file in  ovenplayer/src/js/ovenplayer.js and a mirotalk window benealf the ovenplayer window, there should be zero margin, they should both take up the full width of the screen and together the full height of the window, 


the end user page (all of above) of this needs to be behind a password protected page

these pages needs to be adminsteratable from admin portal, the admin portal needs to be secure and and provide the ability to delete and spawn rooms from the same page, as well as create rooms with custom link names, 

the name of the ovenplayer stream key and the name of the mirotalk room should be the same and randomly generateable from the admin portal, 

please pick the most sutible technology to create this and please intergrate this with trafik, the enduser pages should be on the /path of the colourstream domain, the admin portal should be accessible at admin.colourstream.johnrogerscolour.co.uk
Please look at newer languages, which are generally faster and use less resources
 

Let's create a plan file which we can follow closely put this prompt in the file too.

**1. Technology Selection:**

*   **Go + React (with Typescript)**: Go for backend performance, React for a dynamic frontend, and Typescript for type safety.

**2. Project Structure:**

*   End-user pages on the `/` path of the `colourstream` domain.
*   Admin portal at `admin.colourstream.johnrogerscolour.co.uk`.

**3. Core Components:**

*   **Live Page:**
    *   Ovenplayer (using `ovenplayer/src/js/ovenplayer.js`)
    *   Mirotalk window
    *   Zero margin, full-screen width and height
*   **Admin Portal:**
    *   Secure authentication (username/password)
    *   Room deletion
    *   Room spawning
    *   Custom link name creation
    *   Random stream key/room name generation
*   **Traefik Integration:**
    *   Routing for `/` and `admin.colourstream.johnrogerscolour.co.uk`
    *   SSL certificates (likely using Let's Encrypt)

**4. Plan:**

1.  **Choose a Full-Stack Framework:** Go + React (with Typescript).
2.  **Set up the Go Backend:**
    *   Create a Go API for:
        *   Admin authentication (username/password)
        *   Room creation (with random name generation)
        *   Room deletion
        *   Room listing
    *   Use SQLite to store room information and user credentials.
3.  **Develop the React Frontend:**
    *   Create the live page:
        *   Embed Ovenplayer (using the specified JS file).
        *   Embed Mirotalk.
        *   Ensure zero margin and full-screen display.
    *   Create the admin portal:
        *   Implement authentication (username/password).
        *   Implement room management UI (create, delete, list).
4.  **Integrate with Traefik:**
    *   Configure Traefik to route:
        *   `/` to the React frontend (live page).
        *   `admin.colourstream.johnrogerscolour.co.uk` to the React frontend (admin portal).
    *   Ensure SSL certificates are properly configured.
5.  **Dockerize the Application:**
    *   Create Dockerfiles for the Go backend and React frontend.
    *   Update the `docker-compose.yml` file to include the new services.

**5. Next Steps:**

Are you satisfied with this updated plan? If so, please toggle to Act mode, and I will begin implementing the solution.
