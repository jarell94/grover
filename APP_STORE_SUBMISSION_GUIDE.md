# App Store Submission Guide

This guide covers all requirements for submitting Grover to both the Apple App Store and Google Play Store.

## Table of Contents

1. [iOS App Store Requirements](#ios-app-store-requirements)
2. [Google Play Store Requirements](#google-play-store-requirements)
3. [Common Requirements](#common-requirements)
4. [Pre-Submission Checklist](#pre-submission-checklist)
5. [Submission Process](#submission-process)

---

## iOS App Store Requirements

### 1. App Store Connect Account
- [ ] Apple Developer Program membership ($99/year)
- [ ] App Store Connect account created
- [ ] Bundle ID registered (e.g., com.grover.app)
- [ ] App created in App Store Connect

### 2. Privacy Requirements (CRITICAL)

#### Privacy Policy (Required)
- [ ] Privacy policy URL added to App Store Connect
- [ ] Privacy policy covers all data collection
- [ ] Privacy policy accessible from app
- [ ] Privacy policy in plain language

#### Privacy Manifest (iOS 17+)
Create `ios/PrivacyInfo.xcprivacy`:
- [ ] Declare all tracking domains
- [ ] List all required reasons APIs used
- [ ] Document third-party SDKs

**Required Reasons APIs Used in Grover:**
- File timestamp APIs (camera, media)
- User defaults APIs (preferences)
- System boot time APIs (analytics)
- Disk space APIs (media storage)

#### Data Collection Disclosure
Declare in App Store Connect:
- [ ] User IDs
- [ ] Name and contact info
- [ ] Photos and videos
- [ ] Location data (if used)
- [ ] Usage data
- [ ] Payment info
- [ ] Analytics data

### 3. Technical Requirements

#### App Binary
- [ ] Built with latest stable Xcode
- [ ] Supports latest iOS version (iOS 15+)
- [ ] Valid code signing certificate
- [ ] No crashes or major bugs
- [ ] < 4GB download size (recommended)

#### Metadata
- [ ] App name (< 30 characters)
- [ ] Subtitle (< 30 characters)
- [ ] Description (< 4,000 characters)
- [ ] Keywords (< 100 characters, comma-separated)
- [ ] Support URL
- [ ] Marketing URL (optional)

#### Screenshots & Assets
- [ ] App icon (1024x1024 PNG, no transparency)
- [ ] Screenshots for all required sizes:
  - iPhone 6.7" display (1290 x 2796)
  - iPhone 6.5" display (1242 x 2688)
  - iPhone 5.5" display (1242 x 2208)
  - iPad Pro 12.9" (2048 x 2732)
- [ ] Preview videos (optional, < 30 seconds)

#### Permissions & Entitlements
- [ ] Camera: "Access your camera to take photos and videos"
- [ ] Photo Library: "Access photos to share with your posts"
- [ ] Microphone: "Access microphone for video recording"
- [ ] Notifications: "Receive notifications about messages and updates"
- [ ] Location (if used): Clear justification

### 4. Content Requirements

#### Age Rating
- [ ] Complete questionnaire in App Store Connect
- [ ] Expected rating: 17+ (user-generated content, social networking)
- [ ] Parental controls implemented if needed

#### Content Guidelines
- [ ] No offensive or inappropriate content
- [ ] User-generated content moderation in place
- [ ] Report/block functionality implemented
- [ ] Community guidelines published
- [ ] COPPA compliance (no users under 13)

### 5. Legal Requirements

Required Documents:
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] EULA (End User License Agreement)
- [ ] Community Guidelines
- [ ] Copyright/DMCA policy

### 6. In-App Purchases & Payments

If using PayPal or external payments:
- [ ] **Reader Rule Exception** - Apply if qualifying
- [ ] Or use Apple In-App Purchases (30% commission)
- [ ] Clear payment flow
- [ ] Restore purchases functionality

**Important:** Apple requires IAP for digital goods. Physical products (marketplace) can use external payments.

### 7. Sign in with Apple

**REQUIRED** if you offer other social login options:
- [ ] Implement Sign in with Apple
- [ ] Positioned prominently with other options
- [ ] Use official Sign in with Apple button

### 8. App Review Guidelines Compliance

Critical areas for Grover:
- [ ] 1.2 - User safety features (blocking, reporting)
- [ ] 2.1 - App completeness (no placeholder content)
- [ ] 2.3 - Accurate metadata (no misleading descriptions)
- [ ] 3.1.1 - In-App Purchase requirements
- [ ] 4.2 - Minimum functionality (fully functional)
- [ ] 5.1.1 - Privacy policy and data handling
- [ ] 5.1.2 - Data use and sharing transparency

---

## Google Play Store Requirements

### 1. Google Play Console Account
- [ ] Google Play Developer account ($25 one-time)
- [ ] Play Console access configured
- [ ] App created in Play Console

### 2. Privacy Requirements

#### Privacy Policy (Required)
- [ ] Privacy policy URL in Play Console
- [ ] Covers all data practices
- [ ] Accessible from app
- [ ] Updated within 7 days of changes

#### Data Safety Section
Declare in Play Console:
- [ ] Location data collection
- [ ] Personal info collection
- [ ] Photos and videos collection
- [ ] Financial info (payments)
- [ ] Data sharing practices
- [ ] Data security practices
- [ ] Data deletion procedures

#### Permissions Justification
For each permission, provide:
- [ ] Clear reason for use
- [ ] When it's accessed
- [ ] How it benefits user

**Grover's Permissions:**
- `CAMERA` - Take photos and videos for posts
- `READ_EXTERNAL_STORAGE` - Select media from gallery
- `WRITE_EXTERNAL_STORAGE` - Save downloaded media
- `RECORD_AUDIO` - Record videos with sound
- `INTERNET` - Connect to Grover servers
- `ACCESS_NETWORK_STATE` - Check connectivity
- `VIBRATE` - Haptic feedback for interactions

### 3. Technical Requirements

#### App Bundle
- [ ] Android App Bundle (.aab) format
- [ ] Targets API level 33 (Android 13) minimum
- [ ] Supports 64-bit architectures
- [ ] Signed with release keystore
- [ ] < 150MB APK size (recommended)

#### App Details
- [ ] App name (< 50 characters)
- [ ] Short description (< 80 characters)
- [ ] Full description (< 4,000 characters)
- [ ] App category
- [ ] Contact email
- [ ] Website URL

#### Graphics Assets
- [ ] App icon (512x512 PNG, 32-bit)
- [ ] Feature graphic (1024x500 JPG/PNG)
- [ ] Screenshots (min 2, max 8):
  - Phone: 16:9 or 9:16 ratio
  - Tablet: min 1 screenshot
- [ ] Promo video (YouTube, optional)

### 4. Content Rating

#### IARC Questionnaire
- [ ] Complete questionnaire in Play Console
- [ ] Expected rating: Teen/Mature (social features)
- [ ] Different ratings per region possible

Content to declare:
- [ ] User interaction features
- [ ] User-generated content
- [ ] Social networking features
- [ ] Payment features
- [ ] Location sharing (if applicable)

### 5. Target Audience & Age

- [ ] Primary age group: 18+
- [ ] Secondary age group: 13-17 (with parental consent)
- [ ] COPPA compliance
- [ ] Age verification mechanism

### 6. Legal Requirements

- [ ] Terms of Service URL
- [ ] Privacy Policy URL
- [ ] Content rating certificate
- [ ] Export compliance (US apps)

### 7. Google Play Policies Compliance

Critical policies for Grover:

#### User-Generated Content
- [ ] Content moderation system
- [ ] User reporting mechanism
- [ ] In-app appeals process
- [ ] DMCA compliance
- [ ] Illegal content removal

#### Permissions & APIs
- [ ] Minimum necessary permissions
- [ ] Runtime permission requests
- [ ] Clear permission rationale
- [ ] Sensitive permissions justified

#### Monetization & Payments
- [ ] PayPal payment integration allowed ✅
- [ ] Clear pricing and terms
- [ ] No deceptive practices
- [ ] Refund policy published

#### Security
- [ ] No malware or security vulnerabilities
- [ ] Secure data transmission (HTTPS)
- [ ] No reverse engineering protection
- [ ] Third-party code disclosed

---

## Common Requirements (Both Stores)

### 1. Content Moderation

**Required Features:**
- [ ] Report content (posts, comments, messages)
- [ ] Report users
- [ ] Block users
- [ ] Mute users
- [ ] Content filtering/flagging system
- [ ] Moderator dashboard
- [ ] Automated content scanning (NSFW, violence)

**Implementation Priority:** CRITICAL

### 2. User Safety

- [ ] Age verification (13+ minimum, 18+ recommended)
- [ ] Parental controls (if allowing <18)
- [ ] Privacy settings
- [ ] Account deletion (right to be forgotten)
- [ ] Data export (GDPR compliance)
- [ ] Terms of Service acceptance on signup
- [ ] Community guidelines accessible

### 3. Accessibility (WCAG 2.1 Level AA)

- [ ] VoiceOver/TalkBack support
- [ ] Sufficient color contrast (4.5:1 for text)
- [ ] Scalable text (up to 200%)
- [ ] Touch targets (min 44x44 iOS, 48x48 Android)
- [ ] Keyboard navigation
- [ ] Alternative text for images
- [ ] Captions for videos

### 4. Internationalization

- [ ] Support for multiple languages
- [ ] RTL (right-to-left) language support
- [ ] Locale-specific date/time formatting
- [ ] Currency localization
- [ ] Timezone handling

### 5. Performance

- [ ] App launches in < 2 seconds
- [ ] No ANR (Application Not Responding) errors
- [ ] Memory usage < 200MB typical
- [ ] Battery usage optimized
- [ ] Network efficiency (minimal data usage)
- [ ] Works offline (basic functionality)

### 6. Security

- [ ] HTTPS only (no HTTP)
- [ ] Certificate pinning (recommended)
- [ ] Secure credential storage
- [ ] No hardcoded secrets
- [ ] Encrypted sensitive data
- [ ] Biometric authentication option
- [ ] Session timeout
- [ ] Two-factor authentication (recommended)

### 7. Testing

**Required Tests:**
- [ ] Functional testing (all features work)
- [ ] UI testing (all screens render correctly)
- [ ] Performance testing (no lag, crashes)
- [ ] Security testing (no vulnerabilities)
- [ ] Compatibility testing (multiple devices)
- [ ] Network testing (slow/no connection)
- [ ] Edge case testing (boundary conditions)

**Test on:**
- [ ] Latest iOS version
- [ ] iOS version N-1
- [ ] Latest Android version
- [ ] Android version N-2
- [ ] Low-end devices
- [ ] Various screen sizes
- [ ] Different network conditions

---

## Pre-Submission Checklist

### Development Complete
- [ ] All features implemented
- [ ] All bugs fixed
- [ ] Code optimized
- [ ] Security audit passed
- [ ] Performance benchmarks met

### Legal Documents
- [ ] Privacy Policy published
- [ ] Terms of Service published
- [ ] EULA created
- [ ] Community Guidelines published
- [ ] DMCA/Copyright policy published

### App Store Assets
- [ ] App icon (all sizes)
- [ ] Screenshots (all required sizes)
- [ ] Feature graphics
- [ ] Promo video (optional)
- [ ] App description written
- [ ] Keywords researched
- [ ] Age rating determined

### Technical Setup
- [ ] Build configurations correct
- [ ] Signing certificates valid
- [ ] Push notifications configured
- [ ] Deep linking configured
- [ ] Analytics integrated
- [ ] Crash reporting enabled
- [ ] A/B testing ready (optional)

### Compliance
- [ ] Privacy manifest created (iOS)
- [ ] Data safety filled (Android)
- [ ] Permissions justified
- [ ] Content rating completed
- [ ] Export compliance declared

### Testing
- [ ] Internal testing complete
- [ ] Beta testing complete (TestFlight/Internal Testing)
- [ ] User feedback addressed
- [ ] Performance tested
- [ ] Security tested

---

## Submission Process

### iOS App Store

1. **Prepare Build**
   ```bash
   cd frontend
   eas build --platform ios --profile production
   ```

2. **Upload to App Store Connect**
   - Automatic via EAS Submit or Transporter app
   - Or manual upload via Xcode

3. **Complete App Information**
   - App privacy details
   - Pricing and availability
   - App information
   - Age rating
   - App review information

4. **Submit for Review**
   - Provide test account credentials
   - Add review notes
   - Submit

5. **Review Process**
   - Average time: 24-48 hours
   - May request additional info
   - May reject for guideline violations

6. **Address Feedback**
   - Read rejection reasons carefully
   - Fix issues
   - Resubmit with notes

7. **Release**
   - Manual release or automatic
   - Monitor crash reports
   - Respond to user reviews

### Google Play Store

1. **Prepare Build**
   ```bash
   cd frontend
   eas build --platform android --profile production
   ```

2. **Create Release**
   - Go to Play Console
   - Production → Create new release
   - Upload AAB file

3. **Complete Store Listing**
   - App details
   - Graphics
   - Categorization
   - Contact details
   - Privacy policy

4. **Content Rating**
   - Complete IARC questionnaire
   - Receive rating certificate

5. **Pricing & Distribution**
   - Select countries
   - Set pricing
   - Distribution channels

6. **Review App Content**
   - Complete declarations
   - Target audience
   - News apps (if applicable)
   - COVID-19 contact tracing (if applicable)

7. **Submit for Review**
   - Review and rollout
   - Staged rollout recommended (start with 20%)

8. **Review Process**
   - Can take hours to days
   - May go to manual review
   - Check for policy violations

9. **Release**
   - Gradual rollout
   - Monitor metrics
   - Respond to reviews

---

## Common Rejection Reasons & Solutions

### iOS Rejections

1. **Guideline 2.1 - App Completeness**
   - *Issue:* Crashes, bugs, or incomplete features
   - *Solution:* Thorough testing, fix all bugs

2. **Guideline 3.1.1 - In-App Purchase**
   - *Issue:* Using PayPal for digital goods
   - *Solution:* Use IAP or Reader exception

3. **Guideline 5.1.1 - Privacy**
   - *Issue:* Missing privacy policy or incomplete disclosures
   - *Solution:* Complete privacy manifest, clear policy

4. **Guideline 4.0 - Design**
   - *Issue:* Poor UI, confusing navigation
   - *Solution:* Follow HIG, improve UX

5. **Guideline 5.1.2 - Data Use**
   - *Issue:* Requesting unnecessary permissions
   - *Solution:* Justify all permissions, use minimal set

### Android Rejections

1. **User-Generated Content Policy**
   - *Issue:* Missing moderation or reporting
   - *Solution:* Implement robust content moderation

2. **Permissions Policy**
   - *Issue:* Unnecessary or undeclared permissions
   - *Solution:* Remove unused permissions, declare all

3. **Privacy & Security**
   - *Issue:* Insecure data handling
   - *Solution:* Use HTTPS, encrypt sensitive data

4. **Malware/Security Vulnerabilities**
   - *Issue:* Security issues detected
   - *Solution:* Security audit, fix vulnerabilities

5. **Misleading/Deceptive**
   - *Issue:* Inaccurate descriptions or screenshots
   - *Solution:* Ensure accuracy, remove misleading content

---

## Maintenance After Launch

### Regular Updates
- [ ] Monthly security updates
- [ ] Quarterly feature updates
- [ ] Bug fixes within 48 hours
- [ ] OS compatibility updates

### Monitoring
- [ ] Crash rate < 1%
- [ ] ANR rate < 0.5%
- [ ] 4+ star rating target
- [ ] Review response time < 24 hours

### Compliance
- [ ] Update privacy policy as needed
- [ ] Renew certificates
- [ ] Update content ratings
- [ ] Address store policy changes

---

## Additional Resources

### Official Guidelines
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Developer Policies](https://play.google.com/about/developer-content-policy/)
- [App Store Connect Help](https://developer.apple.com/help/app-store-connect/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer/)

### Tools
- Xcode (iOS builds)
- Android Studio (Android builds)
- EAS Build (Expo managed builds)
- TestFlight (iOS beta testing)
- Google Play Internal Testing (Android beta)

### Support
- Apple Developer Support
- Google Play Developer Support
- Expo Forums
- Stack Overflow

---

**Note:** Requirements change frequently. Always check official documentation before submission.
