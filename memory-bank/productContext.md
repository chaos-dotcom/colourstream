# Product Context

## Why this project exists

The project aims to create a live streaming page with integrated Mirotalk and ovenplayer functionality, secured behind a password-protected admin portal. This enables seamless live streaming with interactive capabilities through Mirotalk's video conferencing features.

## How it should work

1. **Live Page**
   - Displays Ovenplayer at the top half of the screen
   - Shows Mirotalk window at the bottom half
   - Both components take full width
   - Zero margin between components
   - Password protected access

2. **Admin Portal**
   - Accessible at admin.colourstream.johnrogerscolour.co.uk
   - Secure authentication required
   - Room management capabilities:
     - Create new rooms with custom link names
     - Delete existing rooms
     - Generate random stream keys/room names
     - Stream key and room name synchronization

3. **Routing**
   - Traefik handles all routing and SSL certificates
   - End-user pages on root path (/)
   - Admin portal on dedicated subdomain

## User experience goals

1. **End Users**
   - Seamless integration between streaming and chat
   - Full-screen responsive layout
   - Simple password-protected access
   - Zero technical setup required

2. **Administrators**
   - Secure, intuitive admin interface
   - Easy room management
   - Streamlined room creation process
   - Automated stream key/room name synchronization
